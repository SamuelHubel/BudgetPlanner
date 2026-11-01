use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use argon2::{Algorithm, Argon2, Params, Version};
use rusqlite::{Connection, ErrorCode};
use tauri::{AppHandle, Manager, State};
use zeroize::Zeroizing;

use crate::{db::run_migrations, error::AppError, state::AppState, APP_DIRECTORY_NAME};

const DATABASE_FILE: &str = "budget.db";
const SALT_FILE: &str = "kdf.salt";
const SALT_LENGTH: usize = 16;
const KEY_LENGTH: usize = 32;
const ARGON2_MEMORY_KIB: u32 = 64 * 1024;
const ARGON2_ITERATIONS: u32 = 3;
const ARGON2_LANES: u32 = 1;
const MINIMUM_PASSWORD_LENGTH: usize = 12;

fn app_data_directory(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .data_dir()
        .map(|data_dir| data_dir.join(APP_DIRECTORY_NAME))
        .map_err(|error| AppError::ApplicationPath(error.to_string()))
}

fn paths(data_dir: &Path) -> (PathBuf, PathBuf) {
    (data_dir.join(DATABASE_FILE), data_dir.join(SALT_FILE))
}

fn file_exists(path: &Path) -> Result<bool, AppError> {
    match fs::metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}

fn is_initialized_in(data_dir: &Path) -> Result<bool, AppError> {
    let (database_path, salt_path) = paths(data_dir);
    let has_database = file_exists(&database_path)?;
    let has_salt = file_exists(&salt_path)?;

    match (has_database, has_salt) {
        (_, false) => Ok(false),
        (true, true) => {
            read_salt(&salt_path)?;
            Ok(true)
        }
        (false, true) => Err(AppError::InvalidInput(
            "encryption salt exists but the encrypted database is missing; the data cannot be recovered"
                .to_owned(),
        )),
    }
}

fn read_salt(path: &Path) -> Result<[u8; SALT_LENGTH], AppError> {
    let salt = fs::read(path)?;
    salt.try_into()
        .map_err(|_| AppError::InvalidInput("the encryption salt file is invalid".to_owned()))
}

fn derive_key(
    password: &str,
    salt: &[u8; SALT_LENGTH],
) -> Result<Zeroizing<[u8; KEY_LENGTH]>, AppError> {
    let params = Params::new(
        ARGON2_MEMORY_KIB,
        ARGON2_ITERATIONS,
        ARGON2_LANES,
        Some(KEY_LENGTH),
    )
    .map_err(|error| AppError::InvalidInput(error.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = Zeroizing::new([0_u8; KEY_LENGTH]);
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut *key)
        .map_err(|error| AppError::InvalidInput(error.to_string()))?;
    Ok(key)
}

fn set_database_key(connection: &Connection, key: &[u8; KEY_LENGTH]) -> Result<(), AppError> {
    let encoded_key = Zeroizing::new(hex::encode(key));
    let statement = Zeroizing::new(format!("PRAGMA key = \"x'{}'\";", *encoded_key));
    connection.execute_batch(&statement)?;
    Ok(())
}

fn verify_database_key(connection: &Connection) -> Result<(), AppError> {
    connection
        .query_row("SELECT count(*) FROM sqlite_master", [], |row| {
            row.get::<_, i64>(0)
        })
        .map(|_| ())
        .map_err(key_error)
}

/// SQLCipher reports a wrong key as "not a database". Any other failure, such
/// as a busy or unreadable file, says nothing about the password.
fn key_error(error: rusqlite::Error) -> AppError {
    match error.sqlite_error_code() {
        Some(ErrorCode::NotADatabase) => AppError::BadPassword,
        _ => error.into(),
    }
}

fn remove_sqlite_files(path: &Path) -> Result<(), AppError> {
    for suffix in ["", "-wal", "-shm", "-journal"] {
        let mut candidate = path.as_os_str().to_owned();
        candidate.push(suffix);
        let candidate = PathBuf::from(candidate);
        match fs::remove_file(candidate) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }
    Ok(())
}

/// Opens an existing database, proves the key works, and brings it up to date.
fn connect_with_key(path: &Path, key: &[u8; KEY_LENGTH]) -> Result<Connection, AppError> {
    let mut connection = Connection::open(path)?;
    set_database_key(&connection, key)?;
    verify_database_key(&connection)?;
    connection.pragma_update(None, "foreign_keys", true)?;
    run_migrations(&mut connection)?;
    Ok(connection)
}

fn open_encrypted_database(data_dir: &Path, password: &str) -> Result<Connection, AppError> {
    let (database_path, salt_path) = paths(data_dir);
    let salt = read_salt(&salt_path)?;
    if !file_exists(&database_path)? {
        return Err(AppError::InvalidInput(
            "the encrypted database is missing; it cannot be recreated without the original data"
                .to_owned(),
        ));
    }

    let key = derive_key(password, &salt)?;
    connect_with_key(&database_path, &key)
}

fn create_encrypted_database(data_dir: &Path, password: &str) -> Result<Connection, AppError> {
    if password.chars().count() < MINIMUM_PASSWORD_LENGTH {
        return Err(AppError::InvalidInput(format!(
            "password must be at least {MINIMUM_PASSWORD_LENGTH} characters"
        )));
    }

    fs::create_dir_all(data_dir)?;
    let (database_path, salt_path) = paths(data_dir);
    if file_exists(&salt_path)? {
        return Err(AppError::InvalidInput(
            "a password has already been created for this database".to_owned(),
        ));
    }

    let mut salt = [0_u8; SALT_LENGTH];
    getrandom::fill(&mut salt).map_err(|error| AppError::Randomness(error.to_string()))?;
    let key = derive_key(password, &salt)?;

    let temporary_database_path = data_dir.join("budget.db.initializing");
    let temporary_salt_path = data_dir.join(format!("kdf.salt.{}.initializing", hex::encode(salt)));
    remove_sqlite_files(&temporary_database_path)?;
    let mut temporary_connection = Connection::open(&temporary_database_path)?;
    set_database_key(&temporary_connection, &key)?;
    temporary_connection.pragma_update(None, "foreign_keys", true)?;
    run_migrations(&mut temporary_connection)?;
    drop(temporary_connection);

    let mut salt_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary_salt_path)?;
    if let Err(error) = salt_file
        .write_all(&salt)
        .and_then(|()| salt_file.sync_all())
    {
        drop(salt_file);
        fs::remove_file(&temporary_salt_path)?;
        return Err(error.into());
    }
    drop(salt_file);

    let replace_database = (|| -> Result<(), AppError> {
        remove_sqlite_files(&database_path)?;
        fs::rename(&temporary_database_path, &database_path)?;
        fs::rename(&temporary_salt_path, &salt_path)?;
        Ok(())
    })();
    if let Err(error) = replace_database {
        match fs::remove_file(&temporary_salt_path) {
            Ok(()) => {}
            Err(remove_error) if remove_error.kind() == std::io::ErrorKind::NotFound => {}
            Err(remove_error) => return Err(remove_error.into()),
        }
        return Err(error);
    }

    connect_with_key(&database_path, &key)
}

/// Erases the encrypted database and salt. The salt goes last so an
/// interrupted reset leaves a state the lock screen can retry from.
fn reset_vault_in(data_dir: &Path) -> Result<(), AppError> {
    let (database_path, salt_path) = paths(data_dir);
    remove_sqlite_files(&database_path)?;
    match fs::remove_file(salt_path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn drop_database_connection(state: &AppState) -> Result<(), AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError::StateUnavailable)?
        .take();
    Ok(())
}

#[tauri::command(async)]
/// Reports whether a password verifier and encrypted database are initialized.
pub fn is_initialized(app: AppHandle) -> Result<bool, AppError> {
    is_initialized_in(&app_data_directory(&app)?)
}

#[tauri::command(async)]
/// Creates the encrypted database and unlocks it with the first password.
pub fn create_password(
    app: AppHandle,
    state: State<'_, AppState>,
    password: String,
) -> Result<(), AppError> {
    let password = Zeroizing::new(password);
    let mut database = super::connection(&state)?;
    if database.is_some() {
        return Err(AppError::InvalidInput(
            "the database is already unlocked".to_owned(),
        ));
    }
    let connection = create_encrypted_database(&app_data_directory(&app)?, &password)?;
    *database = Some(connection);
    Ok(())
}

#[tauri::command(async)]
/// Opens the encrypted database using the supplied password.
pub fn unlock(
    app: AppHandle,
    state: State<'_, AppState>,
    password: String,
) -> Result<(), AppError> {
    let password = Zeroizing::new(password);
    let mut database = super::connection(&state)?;
    if database.is_some() {
        return Ok(());
    }
    let connection = open_encrypted_database(&app_data_directory(&app)?, &password)?;
    *database = Some(connection);
    Ok(())
}

#[tauri::command(async)]
/// Permanently erases all budget data so a new password can be created.
pub fn reset_vault(app: AppHandle, state: State<'_, AppState>) -> Result<(), AppError> {
    // The guard stays held so an unlock can't reopen the files mid-erase.
    let database = super::connection(&state)?;
    if database.is_some() {
        return Err(AppError::InvalidInput(
            "lock the app before erasing its data".to_owned(),
        ));
    }
    reset_vault_in(&app_data_directory(&app)?)
}

#[tauri::command(async)]
/// Closes the database connection and locks financial data.
pub fn lock(state: State<'_, AppState>) -> Result<(), AppError> {
    drop_database_connection(&state)
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
    };

    use rusqlite::Connection;

    use super::{
        create_encrypted_database, is_initialized_in, key_error, open_encrypted_database,
        reset_vault_in,
    };
    use crate::{error::AppError, state::AppState};

    static NEXT_TEMP_DIR: AtomicU64 = AtomicU64::new(0);

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "budget-planner-auth-{}-{}",
                std::process::id(),
                NEXT_TEMP_DIR.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    fn test_password(name: &str) -> &'static str {
        include_str!("../../../.env.test")
            .lines()
            .find_map(|line| line.strip_prefix(&format!("{name}=")))
            .filter(|password| !password.is_empty())
            .unwrap_or_else(|| panic!("missing {name} in .env.test"))
    }

    #[test]
    fn creates_an_encrypted_database_and_reopens_it_with_the_password() {
        let directory = TestDirectory::new();
        assert!(!is_initialized_in(&directory.0).unwrap());
        let test_password = format!(
            "test-password-{}-{}",
            std::process::id(),
            NEXT_TEMP_DIR.fetch_add(1, Ordering::Relaxed)
        );

        let connection = create_encrypted_database(&directory.0, &test_password).unwrap();
        drop(connection);

        assert!(is_initialized_in(&directory.0).unwrap());
        let database_bytes = fs::read(directory.0.join("budget.db")).unwrap();
        assert!(!database_bytes.starts_with(b"SQLite format 3"));

        let connection = open_encrypted_database(&directory.0, &test_password).unwrap();
        let schema_version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(schema_version, 5);
    }

    #[test]
    fn rejects_a_wrong_password_without_opening_the_database() {
        let directory = TestDirectory::new();
        let password = test_password("BUDGET_PLANNER_TEST_PASSWORD");
        let wrong_password = test_password("BUDGET_PLANNER_TEST_WRONG_PASSWORD");
        drop(create_encrypted_database(&directory.0, password).unwrap());

        let result = open_encrypted_database(&directory.0, wrong_password);
        assert!(matches!(result, Err(AppError::BadPassword)));
    }

    #[test]
    fn deletes_a_legacy_plaintext_database_when_creating_the_password() {
        let directory = TestDirectory::new();
        let legacy_path = directory.0.join("budget.db");
        let legacy = Connection::open(&legacy_path).unwrap();
        legacy
            .execute_batch(
                "CREATE TABLE legacy_data (value TEXT); INSERT INTO legacy_data VALUES ('old');",
            )
            .unwrap();
        drop(legacy);
        fs::write(directory.0.join("budget.db-wal"), b"legacy wal").unwrap();

        let password = test_password("BUDGET_PLANNER_TEST_PASSWORD");
        drop(create_encrypted_database(&directory.0, password).unwrap());

        let connection = open_encrypted_database(&directory.0, password).unwrap();
        let legacy_table_exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name = 'legacy_data')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!legacy_table_exists);
        assert!(!directory.0.join("budget.db-wal").exists());
    }

    #[test]
    fn password_creation_rejects_short_passwords() {
        let directory = TestDirectory::new();
        let short_password = test_password("BUDGET_PLANNER_TEST_SHORT_PASSWORD");
        let result = create_encrypted_database(&directory.0, short_password);
        assert!(matches!(result, Err(AppError::InvalidInput(_))));
        assert!(!directory.0.join("kdf.salt").exists());
        assert!(!directory.0.join("budget.db").exists());
    }

    #[test]
    fn only_a_wrong_key_error_counts_as_a_bad_password() {
        let failure = |code| rusqlite::Error::SqliteFailure(rusqlite::ffi::Error::new(code), None);
        assert!(matches!(
            key_error(failure(rusqlite::ffi::SQLITE_NOTADB)),
            AppError::BadPassword
        ));
        assert!(matches!(
            key_error(failure(rusqlite::ffi::SQLITE_BUSY)),
            AppError::Database(_)
        ));
    }

    #[test]
    fn resetting_erases_the_vault_so_a_new_password_can_be_created() {
        let directory = TestDirectory::new();
        let password = test_password("BUDGET_PLANNER_TEST_PASSWORD");
        drop(create_encrypted_database(&directory.0, password).unwrap());
        fs::write(directory.0.join("budget.db-wal"), b"wal").unwrap();

        reset_vault_in(&directory.0).unwrap();

        assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 0);
        assert!(!is_initialized_in(&directory.0).unwrap());
        drop(create_encrypted_database(&directory.0, password).unwrap());
        assert!(is_initialized_in(&directory.0).unwrap());
    }

    #[test]
    fn resetting_recovers_from_a_salt_without_a_database() {
        let directory = TestDirectory::new();
        fs::write(directory.0.join("kdf.salt"), [0_u8; 16]).unwrap();
        assert!(is_initialized_in(&directory.0).is_err());

        reset_vault_in(&directory.0).unwrap();

        assert!(!is_initialized_in(&directory.0).unwrap());
    }

    #[test]
    fn resetting_an_empty_directory_succeeds() {
        let directory = TestDirectory::new();
        reset_vault_in(&directory.0).unwrap();
    }

    #[test]
    fn locking_drops_the_database_connection() {
        let state = AppState::default();
        *state.db.lock().unwrap() = Some(Connection::open_in_memory().unwrap());

        super::drop_database_connection(&state).unwrap();

        assert!(state.db.lock().unwrap().is_none());
    }
}
