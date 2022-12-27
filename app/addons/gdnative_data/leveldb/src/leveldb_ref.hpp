#ifndef _LevelDB_
#define _LevelDB_

#include <Reference.hpp>
#include "leveldb/db.h"
#include "common.hpp"

class LevelDB : public Reference {
	GODOT_CLASS(LevelDB, Reference)

public:
	static void _register_methods();

	void _init();

	void _notification(int64_t what);

	int open(const String db_path);

	int close();
	
	PoolByteArray get_data(PoolByteArray key);

	void store_data(PoolByteArray key, PoolByteArray value);

	void delete_data(PoolByteArray key);

	bool is_open();

	void next();

	void prev();

	bool valid();

	void seek_to_first();

	void seek_to_last();
	
	PoolByteArray key();

	PoolByteArray value();

private:
	ldb::DB *db;
	ldb::Iterator *iter;
	ldb::Status status;
};

#endif
