'use strict'

import { test, expect } from '@jest/globals'
import { MediaTransboxer } from '../src/mediatransboxer'
import * as fs from 'fs'
import * as path from 'path'
const Blob = require('fetch-blob')

const testFiles = path.join(__dirname, '__test_data__')
const testFile = path.join(testFiles, 'test-1.webm')
const testFileSimpleBlockCount = 41
const webmStream = fs.readFileSync(testFile)

test('transbox basic', done => {
  let outputPacketCount = 0
  let outputByteCount = 0
  const transboxer = new MediaTransboxer({ type: 'video/mp4; codecs="avc1.42C01E"' })
  transboxer.ondataavailable = function (ev) {
    outputPacketCount++
    outputByteCount += ev.data.size
  }

  transboxer.onfinish = function (counts) {
    expect(counts.bytes).toEqual(webmStream.byteLength)
    expect(counts.blocks).toEqual(testFileSimpleBlockCount)
    expect(outputPacketCount).toEqual(testFileSimpleBlockCount)
    expect(outputByteCount).toBeGreaterThan(0)
    done()
  }

  transboxer.writeBuffer(webmStream)
  transboxer.end()
})

test('transbox randomly fragmented', done => {
  let outputPacketCount = 0
  let outputByteCount = 0
  const transboxer = new MediaTransboxer({ type: 'video/mp4; codecs="avc1.42C01E"', initialSize: 23 })
  transboxer.ondataavailable = function (ev) {
    outputPacketCount++
    outputByteCount += ev.data.size
  }

  transboxer.onfinish = function (counts) {
    expect(counts.bytes).toEqual(webmStream.byteLength)
    expect(counts.blocks).toEqual(testFileSimpleBlockCount)
    expect(outputPacketCount).toEqual(testFileSimpleBlockCount)
    expect(outputByteCount).toBeGreaterThan(0)
    done()
  }

  let ptr = 0
  const max = webmStream.byteLength
  /* test: break the incoming data into all sorts of nasty little fragments */
  while (ptr < max) {
    const size = 1 + Math.floor(32 * Math.random())
    let end = ptr + size
    if (end >= max) end = max
    const frag = webmStream.slice(ptr, end)
    ptr = end
    transboxer.writeBuffer(frag)
  }
  transboxer.end()
})

test('transbox one big blob', done => {
  let outputPacketCount = 0
  let outputByteCount = 0
  const transboxer = new MediaTransboxer({ type: 'video/mp4; codecs="avc1.42C01E"' })
  transboxer.ondataavailable = function (ev) {
    outputPacketCount++
    outputByteCount += ev.data.size
  }

  transboxer.onfinish = function (counts) {
    expect(counts.bytes).toEqual(webmStream.byteLength)
    expect(counts.blocks).toEqual(testFileSimpleBlockCount)
    expect(outputPacketCount).toEqual(testFileSimpleBlockCount)
    expect(outputByteCount).toBeGreaterThan(0)
    done()
  }

  const blob = new Blob([webmStream], { type: 'video/webm; codecs="avc1.42C01E"' })
  transboxer.write({ data: blob })
  transboxer.end()
})

test('transbox one big blob and back', done => {
  let outputPacketCount = 0
  let outputByteCount = 0
  const transboxer = new MediaTransboxer({ type: 'video/mp4; codecs="avc1.42C01E"' })
  transboxer.ondataavailable = function (ev) {
    outputPacketCount++
    outputByteCount += ev.data.size
  }

  transboxer.onfinish = function (counts) {
    expect(counts.bytes).toEqual(webmStream.byteLength)
    expect(counts.blocks).toEqual(testFileSimpleBlockCount)
    expect(outputPacketCount).toEqual(testFileSimpleBlockCount)
    expect(outputByteCount).toBeGreaterThan(0)
    done()
  }

  const blob = new Blob([webmStream], { type: 'video/webm; codecs="avc1.42C01E"' })
  blob.arrayBuffer().then(arrayBuffer => {
    try {
      const buffer = Buffer.from(arrayBuffer)
      transboxer.writeBuffer(buffer)
      transboxer.end()
    } catch (e) {
      throw new Error(e)
    }
  })
})

test('transbox randomly fragmented blobs', done => {
  let outputPacketCount = 0
  let outputByteCount = 0
  const transboxer = new MediaTransboxer({ type: 'video/mp4; codecs="avc1.42C01E"', initialSize: 23 })
  transboxer.ondataavailable = function (ev) {
    outputPacketCount++
    outputByteCount += ev.data.size
  }

  transboxer.onfinish = function (counts) {
    expect(counts.bytes).toEqual(webmStream.byteLength)
    expect(counts.blocks).toEqual(testFileSimpleBlockCount)
    expect(outputPacketCount).toEqual(testFileSimpleBlockCount)
    expect(outputByteCount).toBeGreaterThan(0)
    done()
  }

  let ptr = 0
  const max = webmStream.byteLength
  /* test: break the incoming data into all sorts of nasty little fragments */
  while (ptr < max) {
    const size = 1 + Math.floor(256 * Math.random())
    let end = ptr + size
    if (end >= max) end = max
    const frag = webmStream.subarray(ptr, end)
    ptr = end
    const blob = new Blob([frag], { type: 'video/webm; codecs="avc1.42C01E"' })
    transboxer.write({ data: blob })
  }
  transboxer.end()
})
