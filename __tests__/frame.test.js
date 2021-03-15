'use strict'

import { expect, test } from '@jest/globals'
import * as fmp4 from '../src/box.js'

const moofExpected = fmp4.Box.makeArray(
  `
00 00 00 68 6d 6f 6f 66 
    
  00 00 00 10 6d 66 68 64 00 00 00 00
  00 00 00 01 
  
  00 00 00 50 74 72 61 66 
  
    00 00 00 14 74 66 68 64 00 02 00 20
    00 00 00 02 
    01 01 00 00 
    
    00 00 00 14 74 66 64 74 01 00 00 00
    00 00 00 00 
    00 00 00 00 
    
    00 00 00 20 74 72 75 6e 00 00 03 05 
    00 00 00 01 
    00 00 00 70 
    02 00 00 00 
    00 00 03 e8 
    00 00 4b d3


  `)

const shortSamplePayloadHeader = fmp4.Box.makeArray('00 00 00 16 6d 64 61 74')

const shortSamplePayload = fmp4.Box.makeArray(`
00 00 00 02 09 10   
00 00 00 04 68 ce 38 80 `)

const samplePayloadHeader = fmp4.Box.makeArray('00 00 00 68 6d 64 61 74')

const samplePayload = fmp4.Box.makeArray(`
00 00 00 02 09 10   
00 00 00 17 67 42 c0 1e 95 a0 28 0f 68 40 00 00 03 00 40 00 00 0f 03 68 22 11 a8
00 00 00 04 68 ce 38 80  
00 00 00 33 06 05 2f 02 f8 61 50 fc 70 41 72 b7 32 48 f3 a7 2a 3d 34 4d 69 63 72 6f 73 6f 66 74 20 48 2e 32 36 34 20 45 6e 63 6f 64 65 72 20 56 31 2e 35 2e 33 00 80 
`)

test('short mdat', () => {
  const streamBox = new fmp4.StreamBox(null, null,
    {
      type: 'video/webm; codecs="avc1.42C01E"'
    })

  const mdat = new fmp4.MdatAtom(streamBox)
  mdat.populate({ payload: shortSamplePayload })
  mdat.end()
  const output = streamBox.peek()
  expect(output.byteLength).toEqual(8 + shortSamplePayload.byteLength)
  expect(output).toEqual(fmp4.Box.concatArrays([shortSamplePayloadHeader, shortSamplePayload]))
  streamBox.end()
})

test('short mdat with requestData', (done) => {
  const streamBox = new fmp4.StreamBox(null, null,
    {
      type: 'video/webm; codecs="avc1.42C01E"'
    })

  streamBox.ondataavailable = (ev) => {
    ev.data.arrayBuffer()
      .then(arrayBuffer => {
        expect(arrayBuffer.byteLength).toEqual(8 + shortSamplePayload.byteLength)
        done()
      })
  }
  const mdat = new fmp4.MdatAtom(streamBox)
  mdat.populate({ payload: shortSamplePayload })
  mdat.end()
  const output = streamBox.peek()
  expect(output.byteLength).toEqual(8 + shortSamplePayload.byteLength)
  expect(output).toEqual(fmp4.Box.concatArrays([shortSamplePayloadHeader, shortSamplePayload]))
  streamBox.requestData()
})

test('short mdat, three times, with requestData', (done) => {
  let dataAvailableCount = 0

  const streamBox = new fmp4.StreamBox(null, null,
    {
      type: 'video/webm; codecs="avc1.42C01E"'
    })

  streamBox.ondataavailable = (ev) => {
    dataAvailableCount++
    const flushcount = ev.flushcount
    expect(flushcount).toEqual(dataAvailableCount)
    expect(flushcount).toBeLessThanOrEqual(3)
    ev.data.arrayBuffer()
      .then(arrayBuffer => {
        expect(arrayBuffer.byteLength).toEqual(8 + shortSamplePayload.byteLength)
        expect(new Uint8Array(arrayBuffer)).toEqual(fmp4.Box.concatArrays([shortSamplePayloadHeader, shortSamplePayload]))
        if (flushcount === 3) done()
        done()
      })
  }
  let mdat = new fmp4.MdatAtom(streamBox)
  mdat.populate({ payload: shortSamplePayload })
  mdat.end()
  streamBox.requestData()
  streamBox.scribble()
  /* two */
  mdat = new fmp4.MdatAtom(streamBox)
  mdat.populate({ payload: shortSamplePayload })
  mdat.end()
  streamBox.requestData()
  streamBox.scribble()
  /* three */
  mdat = new fmp4.MdatAtom(streamBox)
  mdat.populate({ payload: shortSamplePayload })
  mdat.end()
  streamBox.end()
})

test('mdat', () => {
  const streamBox = new fmp4.StreamBox(null, null,
    {
      type: 'video/webm; codecs="avc1.42C01E"'
    })

  const mdat = new fmp4.MdatAtom(streamBox)
  mdat.populate({ payload: shortSamplePayload })
  mdat.end()
  const output = streamBox.peek()
  expect(output.byteLength).toEqual(8 + shortSamplePayload.byteLength)
  expect(output).toEqual(fmp4.Box.concatArrays([shortSamplePayloadHeader, shortSamplePayload]))
})

test('longer mdat', () => {
  const streamBox = new fmp4.StreamBox(null, null,
    {
      type: 'video/webm; codecs="avc1.42C01E"'
    })

  const mdat = new fmp4.MdatAtom(streamBox)
  mdat.populate({ payload: samplePayload })
  const output = mdat.peek()
  expect(output.byteLength).toEqual(8 + samplePayload.byteLength)
  expect(output).toEqual(fmp4.Box.concatArrays([samplePayloadHeader, samplePayload]))
})

test('mdat, three times, with requestData and end', (done) => {
  let dataAvailableCount = 0

  const streamBox = new fmp4.StreamBox(null, null,
    {
      type: 'video/webm; codecs="avc1.42C01E"'
    })

  streamBox.ondataavailable = (ev) => {
    dataAvailableCount++
    const flushcount = ev.flushcount
    expect(flushcount).toEqual(dataAvailableCount)
    expect(flushcount).toBeLessThanOrEqual(3)
    ev.data.arrayBuffer()
      .then(arrayBuffer => {
        expect(arrayBuffer.byteLength).toEqual(8 + samplePayload.byteLength)
        expect(new Uint8Array(arrayBuffer)).toEqual(fmp4.Box.concatArrays([samplePayloadHeader, samplePayload]))
        if (flushcount === 3) done()
        done()
      })
  }
  let mdat = new fmp4.MdatAtom(streamBox)
  mdat.populate({ payload: samplePayload })
  mdat.end()
  streamBox.requestData()
  streamBox.scribble()
  /* two */
  mdat = new fmp4.MdatAtom(streamBox)
  mdat.populate({ payload: samplePayload })
  mdat.end()
  streamBox.requestData()
  streamBox.scribble()
  /* three */
  mdat = new fmp4.MdatAtom(streamBox)
  mdat.populate({ payload: samplePayload })
  mdat.end()
  streamBox.end()
})
