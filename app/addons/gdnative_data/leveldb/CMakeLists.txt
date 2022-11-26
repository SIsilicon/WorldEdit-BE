cmake_minimum_required(VERSION 3.0.0)
project(leveldb VERSION 0.1.0)

include(CTest)
enable_testing()

file(GLOB SOURCES src/*.cpp)
add_library(leveldb SHARED ${SOURCES})

target_include_directories(leveldb PRIVATE
    "C:/Users/rouje/OneDrive/Documents/leveldb/include"
    "C:/Users/rouje/AppData/Roaming/Godot/godot-cpp/include"
    "C:/Users/rouje/AppData/Roaming/Godot/godot-cpp/include/core"
    "C:/Users/rouje/AppData/Roaming/Godot/godot-cpp/include/gen"
    "C:/Users/rouje/AppData/Roaming/Godot/godot-cpp/godot-headers"
)

find_package(ZLIB)
if(ZLIB_FOUND)
    target_link_libraries(leveldb ${ZLIB_LIBRARIES})
endif(ZLIB_FOUND)

target_link_libraries(leveldb 
    debug "C:/Users/rouje/OneDrive/Documents/leveldb/build/Debug/leveldb.lib"
    optimized "C:/Users/rouje/OneDrive/Documents/leveldb/build/Release/leveldb.lib"
    
    debug "C:/Users/rouje/AppData/Roaming/Godot/godot-cpp/bin/libgodot-cpp.windows.debug.64.lib"
    optimized "C:/Users/rouje/AppData/Roaming/Godot/godot-cpp/bin/libgodot-cpp.windows.release.64.lib"
)

set(CPACK_PROJECT_NAME ${PROJECT_NAME})
set(CPACK_PROJECT_VERSION ${PROJECT_VERSION})
include(CPack)
