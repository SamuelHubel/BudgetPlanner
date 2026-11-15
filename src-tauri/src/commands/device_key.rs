//! Database key bound to the device's own sign-in (Windows Hello).
//!
//! On Windows the key is never stored: Windows Hello signs a fixed challenge
//! with a TPM-held RSA key, and the database key is the SHA-256 of that
//! signature. RSA PKCS#1 v1.5 signatures are deterministic, so the same
//! credential always yields the same key. Other platforms report
//! that device unlock is unavailable and keep the password flow.

/// Database key length in bytes, matching the password-derived key.
pub const KEY_LENGTH: usize = 32;

#[cfg(windows)]
mod platform {
    use sha2::{Digest, Sha256};
    use windows::{
        core::{Array, HSTRING},
        Security::{
            Credentials::{
                KeyCredential, KeyCredentialCreationOption, KeyCredentialManager,
                KeyCredentialStatus,
            },
            Cryptography::CryptographicBuffer,
        },
    };
    use zeroize::Zeroizing;

    use super::KEY_LENGTH;
    use crate::error::AppError;

    const CREDENTIAL_NAME: &str = "BudgetPlanner";
    // Not secret: the private key that signs it is.
    const CHALLENGE: &[u8] = b"BudgetPlanner database key v1";

    fn device_error(error: windows::core::Error) -> AppError {
        AppError::DeviceUnlock(error.message())
    }

    fn status_error(status: KeyCredentialStatus) -> AppError {
        match status {
            KeyCredentialStatus::UserCanceled => AppError::DeviceUnlockCancelled,
            KeyCredentialStatus::NotFound => AppError::DeviceKeyMissing,
            other => AppError::DeviceUnlock(format!("Windows Hello returned status {}", other.0)),
        }
    }

    fn sign(credential: &KeyCredential) -> Result<Zeroizing<[u8; KEY_LENGTH]>, AppError> {
        let challenge =
            CryptographicBuffer::CreateFromByteArray(CHALLENGE).map_err(device_error)?;
        let result = credential
            .RequestSignAsync(&challenge)
            .and_then(|operation| operation.get())
            .map_err(device_error)?;
        let status = result.Status().map_err(device_error)?;
        if status != KeyCredentialStatus::Success {
            return Err(status_error(status));
        }
        let mut signature = Array::<u8>::new();
        CryptographicBuffer::CopyToByteArray(
            &result.Result().map_err(device_error)?,
            &mut signature,
        )
        .map_err(device_error)?;
        let signature = Zeroizing::new(signature.to_vec());
        Ok(Zeroizing::new(Sha256::digest(&*signature).into()))
    }

    /// Reports whether this device can protect the database key itself.
    pub fn is_supported() -> bool {
        KeyCredentialManager::IsSupportedAsync()
            .and_then(|operation| operation.get())
            .unwrap_or(false)
    }

    fn credential_exists() -> bool {
        KeyCredentialManager::OpenAsync(&HSTRING::from(CREDENTIAL_NAME))
            .and_then(|operation| operation.get())
            .and_then(|result| result.Status())
            .is_ok_and(|status| status == KeyCredentialStatus::Success)
    }

    /// Creates (replacing any old one) the device credential and returns its key.
    pub fn create_key() -> Result<Zeroizing<[u8; KEY_LENGTH]>, AppError> {
        let result = KeyCredentialManager::RequestCreateAsync(
            &HSTRING::from(CREDENTIAL_NAME),
            KeyCredentialCreationOption::ReplaceExisting,
        )
        .and_then(|operation| operation.get())
        .map_err(device_error)?;
        let status = result.Status().map_err(device_error)?;
        if status != KeyCredentialStatus::Success {
            return Err(status_error(status));
        }
        let credential = result.Credential().map_err(device_error)?;
        let key = sign(&credential)?;
        // A non-deterministic signature would lock the data away on next unlock.
        if *sign(&credential)? != *key {
            return Err(AppError::DeviceUnlock(
                "Windows Hello signatures are not repeatable on this device".to_owned(),
            ));
        }
        Ok(key)
    }

    /// Prompts for the device sign-in and returns the database key.
    pub fn load_key() -> Result<Zeroizing<[u8; KEY_LENGTH]>, AppError> {
        let result = KeyCredentialManager::OpenAsync(&HSTRING::from(CREDENTIAL_NAME))
            .and_then(|operation| operation.get())
            .map_err(device_error)?;
        let status = result.Status().map_err(device_error)?;
        if status != KeyCredentialStatus::Success {
            return Err(status_error(status));
        }
        sign(&result.Credential().map_err(device_error)?)
    }

    /// Deletes the device credential. A missing credential is not an error.
    pub fn delete_key() -> Result<(), AppError> {
        match KeyCredentialManager::DeleteAsync(&HSTRING::from(CREDENTIAL_NAME))
            .and_then(|operation| operation.get())
        {
            Ok(()) => Ok(()),
            Err(_) if !credential_exists() => Ok(()),
            Err(error) => Err(device_error(error)),
        }
    }
}

/// Platforms without device unlock keep using the password.
#[cfg(not(windows))]
mod platform {
    use zeroize::Zeroizing;

    use super::KEY_LENGTH;
    use crate::error::AppError;

    pub fn is_supported() -> bool {
        false
    }

    fn unavailable() -> AppError {
        AppError::DeviceUnlock("not available on this platform".to_owned())
    }

    pub fn create_key() -> Result<Zeroizing<[u8; KEY_LENGTH]>, AppError> {
        Err(unavailable())
    }

    pub fn load_key() -> Result<Zeroizing<[u8; KEY_LENGTH]>, AppError> {
        Err(unavailable())
    }

    pub fn delete_key() -> Result<(), AppError> {
        Ok(())
    }
}

pub use platform::{create_key, delete_key, is_supported, load_key};
