'use strict'

import { expect, test } from '@jest/globals'

const fmp4 = require('../index.js')

const allNewMoov = fmp4.Box.makeArray('00 00 00 1c 66 74 79 70 6d 70 34 32 00 00 00 01 69 73 6f 6d 6d 70 34 32 61 76 63 31 00 00 00 08 6d 6f 6f 76 ')
const newMoov = fmp4.Box.makeArray('00 00 00 08 6d 6f 6f 76 ')
test('ftyp and new moov', done => {
  const streamBox = new fmp4.Box(null, null, { type: 'video/webm; codecs="avc1.42C01E"' })

  const ftyp = new fmp4.FtypAtom(streamBox).populate()
  ftyp.end()
  const moov = new fmp4.MoovAtom(streamBox)
  expect(moov.peek()).toEqual(newMoov)
  moov.end()
  expect(streamBox.peek()).toEqual(allNewMoov)
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
  done()
})

const mdhdSample = fmp4.Box.makeArray(`
00 00 00 6c  6d 76 68 64 00 00 00 00
   00 00 00 00 
   00 00 00 00 
   00 00 03 e8 
   00 00 00 00 
   
   00 01 00 00 
   01 00 
   
   00 00 
   00 00 00 00 00 00 00 00

    00 01 00 00   00 00 00 00   00 00 00 00 
    00 00 00 00   00 01 00 00   00 00 00 00 
    00 00 00 00   00 00 00 00   40 00 00 00 
    
    00 00 00 00 00 00 00 00 00 00 00 00
    00 00 00 00 00 00 00 00 00 00 00 00 
    ff ff ff ff`)

const tkhdSample = fmp4.Box.makeArray(`
    00 00 00 5c 74 6b 68 64 
    00 00 00 07 
    
    00 00 00 00
    00 00 00 00
    00 00 00 02
    00 00 00 00
    00 00 00 00

    00 00 00 00
    00 00 00 00

    00 00
    00 00
    00 00 
    00 00
    
    00 01 00 00   00 00 00 00   00 00 00 00
    00 00 00 00   00 01 00 00   00 00 00 00
    00 00 00 00   00 00 00 00   40 00 00 00

    01 70 00 00 
    02 9c 00 00 
`)

const tkhdTrakSample = fmp4.Box.makeArray(`
 00 00 00 64 74 72 61 6b 
    00 00 00 5c 74 6b 68 64 
    00 00 00 07 
    
    00 00 00 00
    00 00 00 00
    00 00 00 02
    00 00 00 00
    00 00 00 00

    00 00 00 00
    00 00 00 00

    00 00
    00 00
    00 00 
    00 00
    
    00 01 00 00   00 00 00 00   00 00 00 00
    00 00 00 00   00 01 00 00   00 00 00 00
    00 00 00 00   00 00 00 00   40 00 00 00

    01 70 00 00 
    02 9c 00 00 
`)
test('ftyp, moov, mvhd', done => {
  const streamBox = new fmp4.Box(null, null, { type: 'video/webm; codecs="avc1.42C01E"' })

  const ftyp = new fmp4.FtypAtom(streamBox).populate()
  ftyp.end()
  const moov = new fmp4.MoovAtom(streamBox)
  expect(moov.peek()).toEqual(newMoov)
  const mvhd = new fmp4.MvhdAtom((moov))
  mvhd.populate({ timeScale: 1000 })
  expect(mvhd.peek()).toEqual(mdhdSample)
  mvhd.end()
  moov.end()
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
  done()
})

test('ftyp, moov, mvhd, tkhd', done => {
  const streamBox = new fmp4.Box(null, null, { type: 'video/webm; codecs="avc1.42C01E"' })
  const ftyp = new fmp4.FtypAtom(streamBox).populate()
  ftyp.end()
  const moov = new fmp4.MoovAtom(streamBox)
  expect(moov.peek()).toEqual(newMoov)
  const mvhd = new fmp4.MvhdAtom((moov))
  mvhd.populate({ timeScale: 1000 })
  expect(mvhd.peek()).toEqual(mdhdSample)
  mvhd.end()
  const trak = new fmp4.TrakAtom(streamBox)
  const tkhd = new fmp4.TkhdAtom(trak)
  tkhd.populate({ width: 368, height: 668, trackId: 2 })
  expect(tkhd.peek()).toEqual(tkhdSample)
  tkhd.end()
  expect(trak.peek()).toEqual(tkhdTrakSample)
  trak.end()
  moov.end()
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
  done()
})
