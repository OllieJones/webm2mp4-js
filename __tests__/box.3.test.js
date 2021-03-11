'use strict'

import { expect, test } from '@jest/globals'

import * as fmp4 from '../src/box.js'

const mdiaNewSample = fmp4.Box.makeArray('00 00 00 08 6d 64 69 61')
const mdiaMdhdSample = fmp4.Box.makeArray(`
00 00 00 28 6d 64 69 61 
     00 00 00 20 6d 64 68 64 
     00 00 00 00 
     00 00 00 00 00 00 00 00
     00 00 3a 98 
     00 00 00 00 
     15 e0 00 00 

`)
const mdhdSample = fmp4.Box.makeArray(`
     00 00 00 20 6d 64 68 64 
     00 00 00 00 
     00 00 00 00 00 00 00 00
     00 00 3a 98 
     00 00 00 00 
     15 e0 00 00 

`)

const hdlrSample = fmp4.Box.makeArray(`
00 00 00 35 68 64 6c 72 
     00 00 00 00 
     00 00 00 00 
     76 69 64 65
     00 00 00 00 
     00 00 00 00 
     00 00 00 00 
     42 65 6e 74 6f 34 20 56 69 64 65 6f 20 48 61 6e 64 6c 65 72
     00 `)

test('ftyp moov mvhd trak tkhd mdia', done => {
  const streamBox = new fmp4.Box(null, null, { type: 'video/webm; codecs="avc1.42C01E"' })

  const ftyp = new fmp4.FtypAtom(streamBox).populate()
  ftyp.end()
  const moov = new fmp4.MoovAtom(streamBox)
  const mvhd = new fmp4.MvhdAtom((moov))
  mvhd.populate({ timeScale: 1000 })
  mvhd.end()
  const trak = new fmp4.TrakAtom(streamBox)
  const tkhd = new fmp4.TkhdAtom(trak)
  tkhd.populate({ width: 368, height: 668, trackId: 2 })
  tkhd.end()
  const mdia = new fmp4.MdiaAtom(trak)
  mdia.populate()
  expect(mdia.peek()).toEqual(mdiaNewSample)
  mdia.end()
  trak.end()
  moov.end()
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
  done()
})

test('ftyp moov mvhd trak tkhd mdia', done => {
  const streamBox = new fmp4.Box(null, null, { type: 'video/webm; codecs="avc1.42C01E"' })

  const ftyp = new fmp4.FtypAtom(streamBox).populate()
  ftyp.end()
  const moov = new fmp4.MoovAtom(streamBox)
  const mvhd = new fmp4.MvhdAtom((moov))
  mvhd.populate({ timeScale: 1000 })
  mvhd.end()
  const trak = new fmp4.TrakAtom(streamBox)
  const tkhd = new fmp4.TkhdAtom(trak)
  tkhd.populate({ width: 368, height: 668, trackId: 2 })
  tkhd.end()
  const mdia = new fmp4.MdiaAtom(trak)
  mdia.populate()
  expect(mdia.peek()).toEqual(mdiaNewSample)
  mdia.end()
  trak.end()
  moov.end()
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
  done()
})

test('ftyp moov mvhd trak tkhd mdia mdhd', done => {
  const streamBox = new fmp4.Box(null, null, { type: 'video/webm; codecs="avc1.42C01E"' })

  const ftyp = new fmp4.FtypAtom(streamBox).populate()
  ftyp.end()
  const moov = new fmp4.MoovAtom(streamBox)
  {
    const mvhd = new fmp4.MvhdAtom((moov))
    mvhd.populate({ timeScale: 1000 })
    mvhd.end()
    const trak = new fmp4.TrakAtom(streamBox)
    {
      /* tkhd */
      const tkhd = new fmp4.TkhdAtom(trak)
      tkhd.populate({ width: 368, height: 668, trackId: 2 })
      tkhd.end()
      /* mdia and subatoms */
      const mdia = new fmp4.MdiaAtom(trak)
      {
        mdia.populate()
        expect(mdia.peek()).toEqual(mdiaNewSample)
        const mdhd = new fmp4.MdhdAtom(mdia)
        mdhd.populate({ timeScale: 15000 })
        expect(mdhd.peek()).toEqual(mdhdSample)
        mdhd.end()
        expect(mdia.peek()).toEqual(mdiaMdhdSample)
      }
      mdia.end()
    }
    trak.end()
  }
  moov.end()
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
  done()
})

test('ftyp moov mvhd trak tkhd mdia mdhd hdlr', done => {
  const streamBox = new fmp4.Box(null, null, { type: 'video/webm; codecs="avc1.42C01E"' })

  const ftyp = new fmp4.FtypAtom(streamBox).populate()
  ftyp.end()
  const moov = new fmp4.MoovAtom(streamBox)
  {
    const mvhd = new fmp4.MvhdAtom((moov))
    mvhd.populate({ timeScale: 1000 })
    mvhd.end()
    const trak = new fmp4.TrakAtom(streamBox)
    {
      /* tkhd */
      const tkhd = new fmp4.TkhdAtom(trak)
      tkhd.populate({ width: 368, height: 668, trackId: 2 })
      tkhd.end()
      /* mdia and subatoms */
      const mdia = new fmp4.MdiaAtom(trak)
      {
        mdia.populate()
        expect(mdia.peek()).toEqual(mdiaNewSample)
        const mdhd = new fmp4.MdhdAtom(mdia)
        mdhd.populate({ timeScale: 15000 })
        expect(mdhd.peek()).toEqual(mdhdSample)
        mdhd.end()
        expect(mdia.peek()).toEqual(mdiaMdhdSample)
        /* hdlr */
        const hdlr = new fmp4.HdlrAtom(mdia)
        hdlr.populate({ name: 'Bento4 Video Handler' })
        expect(hdlr.peek()).toEqual(hdlrSample)
        hdlr.end()
      }
      mdia.end()
    }
    trak.end()
  }
  moov.end()
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
  done()
})

test('ftyp moov mvhd trak tkhd mdia mdhd hdlr minf vmhd', done => {
  const streamBox = new fmp4.Box(null, null, { type: 'video/webm; codecs="avc1.42C01E"' })

  const ftyp = new fmp4.FtypAtom(streamBox).populate()
  ftyp.end()
  const moov = new fmp4.MoovAtom(streamBox)
  {
    const mvhd = new fmp4.MvhdAtom((moov))
    mvhd.populate({ timeScale: 1000 })
    mvhd.end()
    const trak = new fmp4.TrakAtom(streamBox)
    {
      /* tkhd */
      const tkhd = new fmp4.TkhdAtom(trak)
      tkhd.populate({ width: 368, height: 668, trackId: 2 })
      tkhd.end()
      /* mdia and subatoms */
      const mdia = new fmp4.MdiaAtom(trak)
      {
        mdia.populate()
        expect(mdia.peek()).toEqual(mdiaNewSample)
        const mdhd = new fmp4.MdhdAtom(mdia)
        mdhd.populate({ timeScale: 15000 })
        expect(mdhd.peek()).toEqual(mdhdSample)
        mdhd.end()
        expect(mdia.peek()).toEqual(mdiaMdhdSample)
        /* hdlr */
        const hdlr = new fmp4.HdlrAtom(mdia)
        hdlr.populate({ name: 'Bento4 Video Handler' })
        expect(hdlr.peek()).toEqual(hdlrSample)
        hdlr.end()
        /* minf -- media information */
        const minf = new fmp4.MinfAtom(mdia)
        {
          /* video media information */
          const vmhd = new fmp4.VmhdAtom(minf)
          vmhd.populate({})
          vmhd.end()
          const minfVmhdSample = fmp4.Box.makeArray(`
            00 00 00 1c 6d 69 6e 66
                00 00 00 14 76 6d 68 64 
                00 00 00 01 
                00 00 00 00 
                00 00 00 00 `)
          expect(minf.peek()).toEqual(minfVmhdSample)

          /* Data information (stub) */
          const dinf = new fmp4.DinfAtom(minf)
          dinf.populate()
          dinf.end()
          const dinfVmhdDinfSample = fmp4.Box.makeArray(`
              00 00 00 40 6d 69 6e 66
                    00 00 00 14 76 6d 68 64 
                    00 00 00 01 
                    00 00 00 00 
                    00 00 00 00 
                 
                    00 00 00 24 64 69 6e 66 
                    
                        00 00 00 1c 64 72 65 66
                        00 00 00 00 
                        00 00 00 01 
                 
                           00 00 00 0c 75 72 6c 20 
                           00 00 00 01 `)
          expect(minf.peek()).toEqual(dinfVmhdDinfSample)

          /* sample table ... description of the media */
        }
        minf.end()
      }
      mdia.end()
    }
    trak.end()
  }
  moov.end()
  streamBox.end()
  expect(streamBox.peek().byteLength).toEqual(0)
  done()
})
