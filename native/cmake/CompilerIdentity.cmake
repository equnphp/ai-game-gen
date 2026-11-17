# 仅支持已明确的单配置Ninja；未知构建动作不能降级成手写版本常量。
if(NOT CMAKE_GENERATOR STREQUAL "Ninja" OR NOT CMAKE_BUILD_TYPE)
  message(FATAL_ERROR "Compiler identity requires single-configuration Ninja with CMAKE_BUILD_TYPE")
endif()
find_program(GG_BUILD_NODE NAMES node REQUIRED)
if(ANDROID)
  set(GG_COMPILER_PACKAGE "${CMAKE_ANDROID_NDK}")
  set(GG_CATALOG_IDENTITY_TOOL "" CACHE FILEPATH "Host-built gg-catalog-identity tool from the same source")
  if(NOT EXISTS "${GG_CATALOG_IDENTITY_TOOL}")
    message(FATAL_ERROR "Android metadata requires GG_CATALOG_IDENTITY_TOOL from the matching Windows host build")
  endif()
  set(GG_CATALOG_TOOL "${GG_CATALOG_IDENTITY_TOOL}")
else()
  get_filename_component(GG_COMPILER_BIN "${CMAKE_CXX_COMPILER}" DIRECTORY)
  get_filename_component(GG_COMPILER_PACKAGE "${GG_COMPILER_BIN}" DIRECTORY)
  add_executable(gg-catalog-identity tools/compiler-identity/catalog.cpp)
  target_link_libraries(gg-catalog-identity PRIVATE gg_values)
  target_include_directories(gg-catalog-identity PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/generated")
  # 构建工具不从用户PATH寻找libc++/winpthread；只链接当前已记录的工具包。
  target_link_options(gg-catalog-identity PRIVATE -static)
  set(GG_CATALOG_TOOL "$<TARGET_FILE:gg-catalog-identity>")
endif()
file(GENERATE OUTPUT "${CMAKE_CURRENT_BINARY_DIR}/generated/compiler-configuration.json" CONTENT
"{\n\"source\":\"${CMAKE_CURRENT_SOURCE_DIR}\",\"build\":\"${CMAKE_CURRENT_BINARY_DIR}\",\"platform\":\"${GG_NATIVE_PLATFORM}\",\"buildType\":\"${CMAKE_BUILD_TYPE}\",\"generator\":\"${CMAKE_GENERATOR}\",\"cmakeVersion\":\"${CMAKE_VERSION}\",\"cmake\":\"${CMAKE_COMMAND}\",\"ninja\":\"${CMAKE_MAKE_PROGRAM}\",\"node\":\"${GG_BUILD_NODE}\",\"compiler\":\"${CMAKE_CXX_COMPILER}\",\"toolchain\":\"${GG_COMPILER_PACKAGE}\",\"catalogTool\":\"${GG_CATALOG_TOOL}\"\n}\n")
add_custom_target(gg_compiler_input_stamp
  COMMAND "${GG_BUILD_NODE}" "${CMAKE_CURRENT_SOURCE_DIR}/tools/compiler-identity/build.cjs" stamp "${CMAKE_CURRENT_BINARY_DIR}/generated/compiler-configuration.json"
  BYPRODUCTS "${CMAKE_CURRENT_BINARY_DIR}/generated/compiler-input-stamp.hpp" VERBATIM)
# 内容stamp在任何传递编译前运行，覆盖同路径工具替换和保留mtime的源码变化。
foreach(GG_TARGET gg_sqlite gg_hash gg_values gg_engine gg_runtime gg_compiler gg_unicode gg_repository ggcore ggartifact gg-catalog-identity gg-core-driver ggcore_jni)
  if(TARGET ${GG_TARGET})
    add_dependencies(${GG_TARGET} gg_compiler_input_stamp)
    get_target_property(GG_TARGET_SOURCES ${GG_TARGET} SOURCES)
    foreach(GG_INPUT IN LISTS GG_TARGET_SOURCES)
      if(GG_INPUT MATCHES "\\.(c|cpp)$")
        set_property(SOURCE "${GG_INPUT}" APPEND PROPERTY OBJECT_DEPENDS "${CMAKE_CURRENT_BINARY_DIR}/generated/compiler-input-stamp.hpp")
      endif()
    endforeach()
  endif()
endforeach()
add_custom_target(gg_compiler_identity
  COMMAND "${GG_BUILD_NODE}" "${CMAKE_CURRENT_SOURCE_DIR}/tools/compiler-identity/build.cjs" prepare "${CMAKE_CURRENT_BINARY_DIR}/generated/compiler-configuration.json"
  DEPENDS gg_repository gg_runtime ${GG_CATALOG_TOOL}
  BYPRODUCTS "${CMAKE_CURRENT_BINARY_DIR}/generated/compiler-build.hpp" "${CMAKE_CURRENT_BINARY_DIR}/compiler-build-inputs.json" "${CMAKE_CURRENT_BINARY_DIR}/generated/compiler-packages.json"
  VERBATIM)
set_source_files_properties(artifact/abi.cpp artifact/build.cpp PROPERTIES OBJECT_DEPENDS "${CMAKE_CURRENT_BINARY_DIR}/generated/compiler-build.hpp")
add_dependencies(ggartifact gg_compiler_identity)
add_custom_target(gg_compiler_identity_verify
  COMMAND "${GG_BUILD_NODE}" "${CMAKE_CURRENT_SOURCE_DIR}/tools/compiler-identity/build.cjs" verify "${CMAKE_CURRENT_BINARY_DIR}/generated/compiler-configuration.json"
  DEPENDS ggartifact ggcore gg_sqlite VERBATIM)
add_dependencies(gg_native_inventory gg_compiler_identity_verify)
