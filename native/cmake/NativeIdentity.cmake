# 身份绑定当前受控源码、依赖、合同及编译配置；不使用尚未提交的Git HEAD冒充源码内容。
file(GLOB_RECURSE GG_IDENTITY_FILES CONFIGURE_DEPENDS RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}"
  "core/*.cpp" "core/*.hpp" "core/*.json" "core/*.sql" "engine/*.cpp" "engine/*.hpp" "engine/*.json"
  "artifact/*.cpp" "artifact/*.h" "artifact/*.json" "platform/*.cpp" "platform/*.hpp" "sdk/*.cpp" "sdk/*.h"
  "third_party/*.c" "third_party/*.h" "cmake/*.cmake" "cmake/*.in" "CMakeLists.txt")
list(SORT GG_IDENTITY_FILES)
set(GG_SOURCE_PREIMAGE "${CMAKE_CXX_COMPILER_ID}/${CMAKE_CXX_COMPILER_VERSION}/${CMAKE_BUILD_TYPE}/${CMAKE_SYSTEM_NAME}/${CMAKE_SYSTEM_PROCESSOR}/${CMAKE_C_FLAGS}/${CMAKE_CXX_FLAGS}\n")
foreach(GG_FILE IN LISTS GG_IDENTITY_FILES)
  file(SHA256 "${CMAKE_CURRENT_SOURCE_DIR}/${GG_FILE}" GG_FILE_HASH)
  string(APPEND GG_SOURCE_PREIMAGE "${GG_FILE}=${GG_FILE_HASH}\n")
  set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/${GG_FILE}")
endforeach()
string(SHA256 GG_SOURCE_HASH "${GG_SOURCE_PREIMAGE}")
file(SHA256 "${CMAKE_CURRENT_SOURCE_DIR}/core/schema/messages.schema.json" GG_REQUEST_1_0_HASH)
file(SHA256 "${CMAKE_CURRENT_SOURCE_DIR}/core/schema/messages_v1_1.schema.json" GG_REQUEST_1_1_HASH)
file(STRINGS "${GG_VENDOR}/sqlite/sqlite3.h" GG_SQLITE_SOURCE_LINE REGEX "^#define SQLITE_SOURCE_ID +\"")
string(REGEX REPLACE "^#define SQLITE_SOURCE_ID +\"([^\"]+)\".*" "\\1" GG_SQLITE_SOURCE_ID "${GG_SQLITE_SOURCE_LINE}")
# 配置哈希采用gg-json-v1的显式编译选项数组，加载器另核对provider实际选项。
string(SHA256 GG_SQLITE_CONFIG_HASH "[\"DQS=0\",\"OMIT_LOAD_EXTENSION\",\"THREADSAFE=1\"]")
set(GG_NATIVE_PLATFORM "windows-x64")
if(ANDROID)
  set(GG_NATIVE_PLATFORM "android-arm64-v8a")
endif()
configure_file("${CMAKE_CURRENT_SOURCE_DIR}/cmake/native-inputs.cmake.in" "${CMAKE_CURRENT_BINARY_DIR}/generated/native-inputs.cmake" @ONLY)
add_custom_target(gg_native_inventory ALL
  COMMAND "${CMAKE_COMMAND}" "-DCORE_FILE=$<TARGET_FILE:ggcore>" "-DARTIFACT_FILE=$<TARGET_FILE:ggartifact>" "-DSQLITE_FILE=$<TARGET_FILE:gg_sqlite>"
    "-DINPUT_FILE=${CMAKE_CURRENT_BINARY_DIR}/generated/native-inputs.cmake" "-DOUTPUT_FILE=${CMAKE_CURRENT_BINARY_DIR}/native-runtime-bundle.json"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/NativeBundle.cmake"
  DEPENDS ggcore ggartifact gg_sqlite VERBATIM)
