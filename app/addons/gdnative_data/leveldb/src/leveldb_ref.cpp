#include <Directory.hpp>
#include <File.hpp>
#include <OS.hpp>
#include <algorithm>
#include <map>

#include "leveldb_ref.hpp"
#include "leveldb/custom_env.h"

#define to_int64(x) static_cast<int64_t>(x)
#define to_int(x) static_cast<int>(x)
#define std2gd(str) String(str.c_str())

#define METHOD_OK(method) (error = (method), error == Error::OK)
#define PRINT_ERR(err) Godot::print(std2gd(std::to_string(to_int(err))))

#if defined(VERBOSE)
#define PRINT_VERBOSE(output) Godot::print(output);
#else
#define PRINT_VERBOSE(output)
#endif //VERBOSE

#define GET_FILE_REF(ref) \
	ERR_FAIL_COND_V(!fileRefs.count(ref), to_int(Error::ERR_INVALID_DATA)); \
	Ref<File> file = fileRefs[ref];

#define FILE_ERROR() ERR_FAIL_COND_V(!METHOD_OK(file->get_error()), (PRINT_ERR(error), to_int(error)));

typedef ldb::file_ref file_ref;
typedef ldb::FILE_ACCESS_FLAGS FILE_ACCESS_FLAGS;
typedef ldb::FILE_SEEK_MODE FILE_SEEK_MODE;
typedef ldb::SYSTEM_TIME SYSTEM_TIME;

Ref<Directory> globalDir;
Ref<File> globalFile;
std::map<int, Ref<File>> fileRefs {};
int refCounter = 0;

int openFile(const std::string &filePath, int fileMode, file_ref *ref)
{
	Error error;
	*ref = 0;
	String gd_filePath = std2gd(filePath);
	Ref<File> file = Ref<File>(File::_new());

	if (!file->file_exists(gd_filePath)) {
		ERR_FAIL_COND_V(fileMode & FILE_ACCESS_FLAGS::EXCL, to_int(Error::ERR_FILE_NOT_FOUND));

		ERR_FAIL_COND_V( \
			(fileMode & FILE_ACCESS_FLAGS::CREATE && fileMode & FILE_ACCESS_FLAGS::READ) &&
			(!METHOD_OK(file->open(gd_filePath, File::ModeFlags::WRITE))),
			to_int(Error::ERR_FILE_NOT_FOUND)
		);
	}

	int64_t gd_fileMode = 0;
	if (fileMode & FILE_ACCESS_FLAGS::READ) {
		gd_fileMode = to_int64(File::ModeFlags::READ);
	} else if (fileMode & FILE_ACCESS_FLAGS::WRITE) {
		if (fileMode & FILE_ACCESS_FLAGS::TRUNC) {
			gd_fileMode = to_int64(File::ModeFlags::WRITE);
		} else {
			gd_fileMode = to_int64(File::ModeFlags::READ_WRITE); // Can't directly change truncate mode
		}
	} else if (fileMode & FILE_ACCESS_FLAGS::READ_WRITE) {
		if (fileMode & FILE_ACCESS_FLAGS::TRUNC) {
			gd_fileMode = to_int64(File::ModeFlags::WRITE_READ);
		} else {
			gd_fileMode = to_int64(File::ModeFlags::READ_WRITE);
		}
	}

	ERR_FAIL_COND_V(!METHOD_OK(file->open(gd_filePath, gd_fileMode)), static_cast<int>(error));
	
	if (fileMode & FILE_ACCESS_FLAGS::APPEND && !(fileMode & FILE_ACCESS_FLAGS::TRUNC)) {
		file->seek_end(0);
	}

	*ref = ++refCounter;
	fileRefs[*ref] = file;

	return 0;
}
extern int (*ldb::openFile)(const std::string &filePath, int fileMode, file_ref *ref) = openFile;

int readFile(const file_ref ref, char *buffer, size_t size, size_t *received)
{
	Error error;
	*received = 0;
	
	GET_FILE_REF(ref);
	
	int64_t fileSize = file->get_len();
	int64_t filePos = file->get_position();
	size = std::min(fileSize - filePos, static_cast<int64_t>(size));

	PoolByteArray byteArray = file->get_buffer(static_cast<int64_t>(size));
	FILE_ERROR();

	memcpy(buffer, byteArray.read().ptr(), byteArray.size());

	*received = byteArray.size();
	PRINT_VERBOSE("Read " + std2gd(std::to_string(*received)) + " bytes");
	return 0;
}
extern int (*ldb::readFile)(const file_ref ref, char *buffer, size_t size, size_t *received) = readFile;

int writeFile(const file_ref ref, const char *buffer, size_t size, size_t *written)
{
	Error error;
	*written = 0;

	GET_FILE_REF(ref);

	PoolByteArray byteArray = PoolByteArray::PoolByteArray();
	byteArray.resize(static_cast<int>(size));
	memcpy(byteArray.write().ptr(), buffer, size);

	file->store_buffer(byteArray);
	FILE_ERROR();
	file->flush();
	FILE_ERROR();

	*written = byteArray.size();
	PRINT_VERBOSE("Wrote " + std2gd(std::to_string(*written)) + " bytes");
	return 0;
}
extern int (*ldb::writeFile)(const file_ref ref, const char *buffer, size_t size, size_t *written) = writeFile;

// int flushFile(const file_ref ref)
// {
//     PRINT_VERBOSE("writeFile");
//     return 1;
// }
// extern int (*ldb::flushFile)(const file_ref ref) = flushFile;

int setFilePointer(const file_ref ref, uint64_t offset, uint64_t *new_offset, FILE_SEEK_MODE mode)
{
	PRINT_VERBOSE("setFilePointer");
	Error error;
	if (new_offset != NULL) *new_offset = 0;

	GET_FILE_REF(ref);
	
	if (new_offset != NULL) *new_offset = file->get_position();
	int64_t s_offset = static_cast<int64_t>(offset);
	switch (mode) {
		case FILE_SEEK_MODE::START:
			file->seek(s_offset);
			break;
		case FILE_SEEK_MODE::END:
			file->seek_end(-s_offset);
			break;
		case FILE_SEEK_MODE::CURRENT:
			file->seek(file->get_position() + s_offset);
			break;
		default:
			ERR_FAIL_V(to_int(Error::ERR_INVALID_PARAMETER));
	}
	FILE_ERROR();

	if (new_offset != NULL) *new_offset = file->get_position();
	return 0;
}
extern int (*ldb::setFilePointer)(const file_ref ref, uint64_t offset, uint64_t *new_offset, FILE_SEEK_MODE mode) = setFilePointer;

int closeFile(const file_ref ref)
{
	Error error;

	GET_FILE_REF(ref);

	String path = file->get_path_absolute();
	file->close();
	error = file->get_error();
	if (error != Error::OK && error != Error::ERR_UNCONFIGURED) {
		ERR_FAIL_V((Godot::print(std2gd(std::to_string(to_int(error)))), to_int(error)));
	}

	PRINT_VERBOSE("Closed " + path);
	fileRefs.erase(ref);
	return 0;
}
extern int (*ldb::closeFile)(const file_ref ref) = closeFile;

bool fileExists(const std::string &filePath)
{
	PRINT_VERBOSE("fileExists " + std2gd(filePath));
	return globalFile->file_exists(std2gd(filePath));
}
extern bool (*ldb::fileExists)(const std::string &filePath) = fileExists;

int getFileSize(const std::string &filePath, uint64_t *size)
{
	PRINT_VERBOSE("getFileSize " + std2gd(filePath));
	Error error;
	*size = 0;

	error = globalFile->open(std2gd(filePath), File::ModeFlags::READ);
	ERR_FAIL_COND_V(error != Error::OK, to_int(error));

	*size = globalFile->get_len();
	globalFile->close();
	return 0;
}
extern int (*ldb::getFileSize)(const std::string &filePath, uint64_t *size) = getFileSize;

int deleteFile(const std::string &filePath)
{
	PRINT_VERBOSE("deleteFile " + std2gd(filePath));
	Error error = globalDir->remove(std2gd(filePath));
	ERR_FAIL_COND_V(error != Error::OK, (PRINT_ERR(error), to_int(error)));
	return 0;
}
extern int (*ldb::deleteFile)(const std::string &filePath) = deleteFile;

int renameFile(const std::string &from, const std::string &to)
{
	PRINT_VERBOSE("renameFile " + std2gd(from) + " to " + std2gd(to));
	Error error;

	if (fileExists(to)) {
		error = static_cast<Error>(deleteFile(to));
		ERR_FAIL_COND_V(error != Error::OK, (PRINT_ERR(error), to_int(error)));
	}
	error = globalDir->rename(std2gd(from), std2gd(to));
	ERR_FAIL_COND_V(error != Error::OK, (PRINT_ERR(error), to_int(error)));
	return 0;
}
extern int (*ldb::renameFile)(const std::string &from, const std::string &to) = renameFile;

int deleteDir(const std::string &dirPath)
{
	PRINT_VERBOSE("deleteDir " + std2gd(dirPath));
	Error error = globalDir->remove(std2gd(dirPath));
	ERR_FAIL_COND_V(error != Error::OK, to_int(error));
	return 0;
}
extern int (*ldb::deleteDir)(const std::string &dirPath) = deleteDir;

int createDir(const std::string &dirPath)
{
	PRINT_VERBOSE("createDir " + std2gd(dirPath));
	Error error = globalDir->make_dir_recursive(std2gd(dirPath));
	ERR_FAIL_COND_V(error != Error::OK, to_int(error));
	return 0;
}
extern int (*ldb::createDir)(const std::string &dirPath) = createDir;

int listDirChildren(const std::string &dirPath, std::vector<std::string> *result)
{
	PRINT_VERBOSE("listDirChildren " + std2gd(dirPath));
	String gd_dirPath = std2gd(dirPath);
	String currentDir = globalDir->get_current_dir();
	Error error = Error::OK;

	#define __listDirReturn__ (globalDir->change_dir(currentDir), to_int(error))

	error = globalDir->change_dir(gd_dirPath);
	ERR_FAIL_COND_V(error != Error::OK, __listDirReturn__);
	error = globalDir->list_dir_begin(true);
	ERR_FAIL_COND_V(error != Error::OK, __listDirReturn__);

	String child;
	while ((child = globalDir->get_next(), !child.empty())) {
		result->insert(result->end(), child.alloc_c_string());
		PRINT_VERBOSE(child);
	}
	globalDir->list_dir_end();

	return __listDirReturn__;
	#undef __listDirReturn__
}
extern int (*ldb::listDirChildren)(const std::string &dirPath, std::vector<std::string> *result) = listDirChildren;

int getTempDir(std::string *path)
{
	*path = "C:/Windows/Temp";
	return 0;
}
extern int (*ldb::getTempDir)(std::string *path) = getTempDir;

uint64_t getTimeMillis()
{
	return OS::get_singleton()->get_system_time_msecs();
}
extern uint64_t (*ldb::getTimeMillis)() = getTimeMillis;

SYSTEM_TIME getLocalTime()
{
	Dictionary time = OS::get_singleton()->get_datetime();
	uint64_t msec = getTimeMillis();
	return {
		time["year"], time["month"],
		time["weekday"], time["day"],
		time["hour"], time["minute"],
		time["second"], static_cast<uint16_t>(msec % 1000)
	};
}
extern SYSTEM_TIME (*ldb::getLocalTime)() = getLocalTime;

#include "leveldb/env.h"
#include "leveldb/filter_policy.h"
#include "leveldb/cache.h"

class NullLogger : public ldb::Logger {
public:
	void Logv(const char* format, va_list va) override {
		//char p[1024];
		//vsnprintf(p, sizeof(p)/sizeof(char), format, va);
		//std::cout << p << "\n";
	}
};

inline ldb::Slice PoolByteArray2Slice(PoolByteArray array) {
	return ldb::Slice::Slice(
		reinterpret_cast<const char*>(array.read().ptr()),
		static_cast<size_t>(array.size())
	);
}

void LevelDB::_register_methods() {
	register_method("open", &LevelDB::open);
	register_method("close", &LevelDB::close);

	register_method("get_data", &LevelDB::get_data);
	register_method("store_data", &LevelDB::store_data);
	register_method("delete_data", &LevelDB::delete_data);

	register_method("next", &LevelDB::next);
	register_method("prev", &LevelDB::prev);
	register_method("valid", &LevelDB::valid);
	register_method("seek_to_first", &LevelDB::seek_to_first);
	register_method("seek_to_last", &LevelDB::seek_to_last);
	register_method("key", &LevelDB::key);
	register_method("value", &LevelDB::value);
}

// This functions needs to exist whether you use it or not.
void LevelDB::_init() {
	db = nullptr;
	iter = nullptr;
	status = ldb::Status::OK();

	if (globalDir == nullptr) {
		Godot::print("Initializing global objects");
		globalFile = Ref<File>(File::_new());
		globalDir = Ref<Directory>(Directory::_new());
		globalDir->open("C:/"); // WINDOWS SPECIFIC! CHANGE FOR HTML OR SOMETHING
	}
}

void LevelDB::_notification(int64_t what) {
	if (what == NOTIFICATION_PREDELETE && is_open()) {
		close();
	}
}

int LevelDB::open(const String db_path) {
	ERR_FAIL_COND_V(db != nullptr, to_int(Error::ERR_ALREADY_IN_USE));

	// This options and compressor related stuff comes from
	// mcpe_sample_setup.cpp in leveldb-mcpe
	ldb::Options options;

	//create a bloom filter to quickly tell if a key is in the database or not
	options.filter_policy = ldb::NewBloomFilterPolicy(10);

	//create a 40 mb cache (we use this on ~1gb devices)
	options.block_cache = ldb::NewLRUCache(40 * 1024 * 1024);

	//create a 4mb write buffer, to improve compression and touch the disk less
	options.write_buffer_size = 4 * 1024 * 1024;

	//disable internal logging. The default logger will still print out things to a file
	options.info_log = new NullLogger();

	//use the new raw-zip compressor to write (and read)
	options.compression = ldb::CompressionType::kZlibCompression;
	
	status = ldb::DB::Open(options, db_path.alloc_c_string(), &db);
	ERR_FAIL_COND_V(!status.ok(), 1); // Error::FAILED;

	iter = db->NewIterator(ldb::ReadOptions());
	return 0; // Error::OK;
}

int LevelDB::close() {
	delete iter;
	delete db;
	db = nullptr;
	return 0;
}

PoolByteArray LevelDB::get_data(PoolByteArray key) {
	PoolByteArray result = PoolByteArray::PoolByteArray();
	ERR_FAIL_COND_V(db == nullptr, result);

	std::string data;
	status = db->Get(ldb::ReadOptions(), PoolByteArray2Slice(key), &data);

	result.resize(static_cast<int>(data.size()));
	memcpy(result.write().ptr(), data.data(), data.size());
	return result;
}

void LevelDB::store_data(PoolByteArray key, PoolByteArray value) {
	ERR_FAIL_COND(db == nullptr);
	status = db->Put(ldb::WriteOptions(), PoolByteArray2Slice(key), PoolByteArray2Slice(value));
	return;
}

void LevelDB::delete_data(PoolByteArray key) {
	ERR_FAIL_COND(db == nullptr);
	status = db->Delete(ldb::WriteOptions(), PoolByteArray2Slice(key));
	return;
}

bool LevelDB::is_open() {
	return db != nullptr;
}

void LevelDB::next() {
	iter->Next();
}

void LevelDB::prev() {
	iter->Prev();
}

bool LevelDB::valid() {
	return iter->Valid();
}

void LevelDB::seek_to_first() {
	iter->SeekToFirst();
}

void LevelDB::seek_to_last() {
	iter->SeekToLast();
}

PoolByteArray LevelDB::key() {
	ldb::Slice slice = iter->key();
	PoolByteArray array = PoolByteArray::PoolByteArray();
	array.resize(static_cast<int>(slice.size()));
	memcpy(array.write().ptr(), slice.data(), slice.size());
	return array;
}

PoolByteArray LevelDB::value() {
	ldb::Slice slice = iter->value();
	PoolByteArray array = PoolByteArray::PoolByteArray();
	array.resize(static_cast<int>(slice.size()));
	memcpy(array.write().ptr(), slice.data(), slice.size());
	return array;
}
