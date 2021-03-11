'use strict'

import { expect, test } from '@jest/globals'
import * as h264tools from 'h264-interp-utils'
import * as fmp4 from '../src/box.js'

const trakExpected = fmp4.Box.makeArray(
  `
   00 00 01 de 74 72 61 6b 
 
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

 00 00 01 7a 6d 64 69 61 
 
     00 00 00 20 6d 64 68 64 
     00 00 00 00 
     00 00 00 00 00 00 00 00
     00 00 3a 98 
     00 00 00 00 
     15 e0 00 00 
     
     00 00 00 35 68 64 6c 72 
     00 00 00 00 
     00 00 00 00 
     76 69 64 65
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     42 65 6e 74 6f 34 20 56 69 64 65 6f 20 48 61 6e 64 6c 65 72
     00 
     
     00 00 01 1d 6d 69 6e 66
        00 00 00 14 76 6d 68 64 
        00 00 00 01 
        00 00 00 00 
        00 00 00 00 
     
        00 00 00 24 64 69 6e 66 
        
            00 00 00 1c 64 72 65 66
            00 00 00 00 
            00 00 00 01 
     
               00 00 00 0c 75 72 6c 20 
               00 00 00 01 
     
     00 00 00 dd 73 74 62 6c 
     
     00 00 00 91 73 74 73 64
     00 00 00 00 
     00 00 00 01

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
 
  00 00 00 14 73 74 73 7a 00 00 00 00
  00 00 00 00 
  00 00 00 00 
  
  00 00 00 10 73 74 73 63 00 00 00 00
  00 00 00 00 
  
  00 00 00 10 73 74 74 73 00 00 00 00 
  00 00 00 00 
  
  00 00 00 10 73 74 63 6f 00 00 00 00
  00 00 00 00 
  `)

const codecPrivateArray = fmp4.Box.makeArray(`
     01 4d 40 1e 
     ff e1 00 14 
     27 4d 40 1e  
     a9 18 2e 0a bf 78 0b 70 60 10 6e c2 b5
 ef 7c 04 01 00 04 28 fe 09 c8 
`)

test('trakVideo', () => {
  const codecPrivate = new h264tools.AvcC({ avcC: codecPrivateArray })
  const streamBox = new fmp4.Box(null, null,
    {
      type: 'video/webm; codecs="avc1.42C01E"'
    })

  fmp4.trakVideo(streamBox, { avcC: codecPrivate.avcC },
    {
      width: 368,
      height: 668,
      timeScale: 15000,
      name: 'Bento4 Video Handler'
    })
  expect(streamBox.peek()).toEqual(trakExpected)
})
