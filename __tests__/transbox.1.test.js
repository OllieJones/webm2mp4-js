'use strict'

import { test, expect } from '@jest/globals'
import { MediaTransboxer } from '../src/mediatransboxer'
import * as fs from 'fs'
import * as path from 'path'

const testFiles = path.join(__dirname, '__test_data__')
const testFile = path.join(testFiles, 'test-1.webm')
const testFileSimpleBlockCount = 41
const webmStream = fs.readFileSync(testFile)

test('transbox basic', done => {
  const transboxer = new MediaTransboxer({ type: 'video/mp4; codecs="avc1.42C01E"' })
  transboxer.ondataavailable = function (ev) {
    console.log('data')
  }

  transboxer.onfinish = function (counts) {
    expect(counts.bytes).toEqual(webmStream.byteLength)
    expect(counts.blocks).toEqual(testFileSimpleBlockCount)
    done()
  }

  transboxer.writeBuffer(webmStream)
  transboxer.end()
})

test('transbox randomly fragmented', done => {
  const transboxer = new MediaTransboxer({ type: 'video/mp4; codecs="avc1.42C01E"', initialSize: 23 })
  transboxer.ondataavailable = function (ev) {
    console.log('data')
  }

  transboxer.onfinish = function (counts) {
    expect(counts.bytes).toEqual(webmStream.byteLength)
    expect(counts.blocks).toEqual(testFileSimpleBlockCount)
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
