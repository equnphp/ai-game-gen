package com.aimeta.gamegen.core

// 薄绑定只交换字节与句柄；宿主在后台线程创建Core，并负责轮询与关闭。
object NativeCore {
    init { System.loadLibrary("ggcore_jni") }
    external fun create(authorizedRootUtf8: ByteArray): Long
    external fun submit(core: Long, requestUtf8: ByteArray): Long
    external fun uploadWrite(core: Long, uploadIdUtf8: ByteArray, offset: Long, bytes: ByteArray): Long
    external fun blobRead(core: Long, contentHashUtf8: ByteArray, offset: Long, maximum: Int): Long
    external fun poll(core: Long, task: Long): ByteArray
    external fun takeResult(core: Long, task: Long): Array<ByteArray>
    external fun cancel(core: Long, task: Long)
    external fun releaseTask(core: Long, task: Long)
    external fun events(core: Long, afterSequence: Long, limit: Int): ByteArray
    external fun destroy(core: Long)
}
