'use strict'

import { expect, test } from '@jest/globals'

import * as h264tools from 'h264-interp-utils'
import * as fmp4 from '../src/box.js'

const avc1Only = fmp4.Box.makeArray(
  `
  00 00 00 56 61 76 63 31
     00 00 00 00 
     00 00 00 01 
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     01 70 
     02 9c 
     00 48 00 00 
     00 48 00 00 
     00 00 00 00 
     00 01 
     04 
     68 32 36 34 00 
     
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     00 00 00 18 
     ff ff  `)

const codecPrivateArray = fmp4.Box.makeArray(`
     01 4d 40 1e 
     ff e1 00 14 
     27 4d 40 1e  
     a9 18 2e 0a bf 78 0b 70 60 10 6e c2 b5
 ef 7c 04 01 00 04 28 fe 09 c8 
`)

const avc1avcC = fmp4.Box.makeArray(`
   00 00 00 81 61 76 63 31
     00 00 00 00 
     00 00 00 01 
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     01 70 
     02 9c 
     00 48 00 00 
     00 48 00 00 
     00 00 00 00 
     00 01 
     04 
     68 32 36 34 00 
     
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     00 00 00 18 
     ff ff 
     00 00 00 2b 61 76 63 43    
     01 4d 40 1e 
     ff e1 00 14 
     27 4d 40 1e  
     a9 18 2e 0a bf 78 0b 70 60 10 6e c2 b5
 ef 7c 04 01 00 04 28 fe 09 c8 
`)

test('Avc1 plain', () => {
  const streamBox = new fmp4.Box(null, null,
    {
      initialSize: 17,
      type: 'video/webm; codecs="avc1.42C01E"'
    })
  const avc1 = new fmp4.Avc1Atom(streamBox)
  avc1.populate({ width: 368, height: 668 })
  expect(avc1.peek()).toEqual(avc1Only)
  avc1.end()
  expect(streamBox.peek()).toEqual(avc1Only)
})

test('avc1 with avcC', () => {
  const codecPrivate = new h264tools.AvcC({ avcC: codecPrivateArray })
  const streamBox = new fmp4.StreamBox(null, null,
    {
      initialSize: 17,
      type: 'video/webm; codecs="avc1.42C01E"'
    })
  const avc1 = new fmp4.Avc1Atom(streamBox)
  avc1.populate({ width: 368, height: 668 })
  expect(avc1.peek()).toEqual(avc1Only)
  const avcc = new fmp4.AvcCAtom(avc1)
  avcc.populate({ codecPrivate: codecPrivate.avcC })
  avcc.end()
  expect(avc1.peek()).toEqual(avc1avcC)
  avc1.end()
  expect(streamBox.peek()).toEqual(avc1avcC)
})

test('avc1 with avcC, with stuff from sps', () => {
  const codecPrivate = new h264tools.AvcC({ avcC: codecPrivateArray })
  const sps = new h264tools.SPS(codecPrivate.sps[0])
  const spsWidth = sps.picWidth
  const spsHeight = sps.picHeight
  const width = 368
  const height = 668
  /* sizes from sps are full macroblocks. */
  expect(width).toBeLessThanOrEqual(spsWidth)
  expect(width).toBeGreaterThan(spsWidth - 16)
  expect(height).toBeLessThanOrEqual(spsHeight)
  expect(height).toBeGreaterThan(spsHeight - 16)
  const streamBox = new fmp4.Box(null, null,
    {
      initialSize: 17,
      type: 'video/webm; codecs="avc1.42C01E"'
    })
  const avc1 = new fmp4.Avc1Atom(streamBox)
  avc1.populate({ width, height })
  expect(avc1.peek()).toEqual(avc1Only)
  const avcc = new fmp4.AvcCAtom(avc1)
  avcc.populate({ codecPrivate: codecPrivate.avcC })
  avcc.end()
  expect(avc1.peek()).toEqual(avc1avcC)
  avc1.end()
  expect(streamBox.peek()).toEqual(avc1avcC)
})
