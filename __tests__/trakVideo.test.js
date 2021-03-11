'use strict'

import { expect, test } from '@jest/globals'

import * as fmp4 from '../src/box.js'

const mvexExpected = fmp4.Box.makeArray(
  `
00 00 00 38 6d 76 65 78

    00 00 00 10 6d 65 68 64 00 00 00 00
    00 00 00 00 
    
    00 00 00 20 74 72 65 78 00 00 00 00 
    00 00 00 02 
    00 00 00 01 
    00 00 00 00
    00 00 00 00 
    00 00 00 00 
      `)

test('trex basic', () => {
  const streamBox = new fmp4.Box(null, null,
    {
      type: 'video/webm; codecs="avc1.42C01E"'
    })

  const mvex = new fmp4.MvexAtom(streamBox)
  new fmp4.MehdAtom(mvex).populate({}).end()
  new fmp4.TrexAtom(mvex).populate({ trackId: 2 }).end()
  expect(mvex.peek()).toEqual(mvexExpected)
  mvex.end()
  expect(streamBox.peek()).toEqual(mvexExpected)
})

test('trex convenience function', () => {
  const streamBox = new fmp4.Box(null, null,
    {
      type: 'video/webm; codecs="avc1.42C01E"'
    })

  fmp4.trexVideo(streamBox, { trackId: 2 })
  expect(streamBox.peek()).toEqual(mvexExpected)
})
