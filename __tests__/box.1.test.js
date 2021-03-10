'use strict'

import { expect, test } from '@jest/globals'

const fmp4 = require('../index.js')

const expected = fmp4.Box.makeArray('00 00 00 1c 66 74 79 70 6d 70 34 32 00 00 00 01 69 73 6f 6d 6d 70 34 32 61 76 63 31')

test('ftyp class repeated end', done => {
  const streamBox = new fmp4.Box(null, null, { type: 'video/webm; codecs="avc1.42C01E"' })

  const ftyp = new fmp4.FtypAtom(streamBox).populate()
  expect(ftyp.peek()).toEqual(expected)
  ftyp.end()
  expect(() => {
    ftyp.end()
  }).toThrow('cannot end() an atom more than once')
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
  done()
})

test('ftyp class, force buffer reallocation', done => {
  const streamBox = new fmp4.Box(null, null,
    {
      initialSize: 17,
      type: 'video/webm; codecs="avc1.42C01E"'
    })
  streamBox.ondataavailable = function (event) {
    event.data.arrayBuffer()
      .then(buffer => {
        const arr = new Uint8Array(buffer)
        expect(arr).toEqual(expected)
        done()
      })
  }

  const ftyp = new fmp4.FtypAtom(streamBox).populate()
  expect(ftyp.peek()).toEqual(expected)
  ftyp.end()
  expect(ftyp.peek().byteLength).toEqual(0)
  expect(streamBox.peek()).toEqual(expected)
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
})

test('ftyp class', done => {
  const streamBox = new fmp4.Box(null, null, { type: 'video/webm; codecs="avc1.42C01E"' })
  streamBox.ondataavailable = function (event) {
    event.data.arrayBuffer()
      .then(buffer => {
        const arr = new Uint8Array(buffer)
        expect(arr).toEqual(expected)
        done()
      })
  }

  const ftyp = new fmp4.FtypAtom(streamBox).populate()
  expect(ftyp.peek()).toEqual(expected)
  ftyp.end()
  expect(ftyp.peek().byteLength).toEqual(0)
  expect(streamBox.peek()).toEqual(expected)
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
})

test('ftyp raw', done => {
  const streamBox = new fmp4.Box(null, null, { type: 'video/webm; codecs="avc1.42C01E"' })
  streamBox.ondataavailable = function (event) {
    event.data.arrayBuffer()
      .then(buffer => {
        const arr = new Uint8Array(buffer)
        expect(arr).toEqual(expected)
        done()
      })
  }

  const ftyp = new fmp4.Box('ftyp', streamBox, {})
  ftyp.fourcc('mp42', 'major_brand')
  ftyp.uint32(1, 'minor_version')
  ftyp.fourcc(['isom', 'mp42', 'avc1'], 'compatible_brand')
  ftyp.end()
  expect(streamBox.peek()).toEqual(expected)
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
})
