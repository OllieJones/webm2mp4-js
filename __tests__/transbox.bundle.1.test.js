'use strict'

import { expect, test } from '@jest/globals'
import { Blob } from 'blob-polyfill'
import { MediaTransboxer } from '../dist/mediatransboxer.js'
import * as fs from 'fs'
import * as path from 'path'

const testFiles = path.join(__dirname, '__test_data__')
const testFileName = 'cluster-4.webm'
const testFile = path.join(testFiles, testFileName)
const testFileSimpleBlockCount = 307
const webmStream = fs.readFileSync(testFile)
const outfilePath = path.join(testFiles, testFileName + '.mp4')

test('transbox handle timestamps', done => {
  const transboxer = new MediaTransboxer({ type: 'video/mp4; codecs="avc1.42C01E"' })
  const blobs = []

  transboxer.ondataavailable = function (ev) {
    blobs.push(ev.data)
    ev.data.arrayBuffer()
      .then(buffer => {
        expect(buffer.byteLength).toEqual(ev.data.size)
      })
  }

  transboxer.onfinish = function (counts) {
    expect(counts.bytes).toEqual(webmStream.byteLength)
    expect(counts.blocks).toEqual(testFileSimpleBlockCount)
    const allBlobs = new Blob(blobs, { type: transboxer.type })
    allBlobs.arrayBuffer()
      .then(buffer => {
        expect(buffer.byteLength).toEqual(allBlobs.size)
        if (fs.existsSync(outfilePath)) fs.unlinkSync(outfilePath)
        fs.writeFile(outfilePath, new Uint8Array(buffer), (err) => {
          if (err) throw new Error(err)
          done()
        })
      })
  }

  transboxer.writeBuffer(webmStream)
  transboxer.end()
})
