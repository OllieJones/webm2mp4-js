import * as h264tools from 'h264-interp-utils'
import { Decoder } from 'ebml'
import * as fmp4 from '../src/box.js'

class MediaTransboxer {
  decoderOptions = {}
  webmValues = {}
  webmPath = []
  ondataavailable = function (ev) { /* stub */}
  onfinish = function (ev) { /* stub */}
  firstPayload = true
  type = 'video/mp4 codecs="avc1.42C01E"'
  counts = { packets: 0, bytes: 0, blocks: 0 }
  timecodeScale = 1 /* milliseconds per clock tick */
  clusterTimecode = 0
  writeInProgress = 0
  previousSampleTime = 0

  constructor (options) {
    if (!options) options = {}
    if (typeof options.ondataavailable === 'function')
      this.ondataavailable = options.ondataavailable
    if (typeof options.onfinish === 'function')
      this.onfinish = options.onfinish
    if (typeof options.type === 'string')
      this.type = options.type
    const boxOptions = {}
    boxOptions.type = this.type
    if (typeof options.initialSize === 'number') boxOptions.initialSize = options.initialSize
    this.streamBox = new fmp4.StreamBox(null, null, boxOptions)
    this.ebmlDecoder = new Decoder()
    this.ebmlDecoder.on('data', this.deboxed.bind(this))
    this.ebmlDecoder.on('finish', this.deboxEnd.bind(this))

    this.streamBox.ondataavailable = (ev) => {
      if (typeof this.ondataavailable === 'function') this.ondataavailable(ev)
    }
  }

  /**
   * write a buffer to the decoder
   * @param buffer
   */
  writeBuffer (buffer) {
    this.counts.packets += 1
    this.counts.bytes += buffer.byteLength
    this.writeInProgress++
    this.ebmlDecoder.write(buffer)
    this.writeInProgress--
    if (this.writeInProgress <= 0 && this.endDeferred) {
      this.end()
    }
  }

  /**
   *
   * @param blob
   * @returns {Promise<ArrayBuffer>|ArrayBuffer}
   */
  arrayBufferFromBlob (blob) {
    if (typeof process !== 'object') {
      /* browser, braindamage in older Safari */
      return Response.prototype.arrayBuffer.call(blob)
    } else {
      return blob.arrayBuffer.call(blob)
    }
  }

  /**
   * This function is useful as
   * ondataavailable for MediaRecorder
   * @param event
   */
  write (event) {
    this.writeInProgress++
    /* portable conversion of Blob to arrayBuffer */
    this.arrayBufferFromBlob(event.data)
      .then(arrayBuffer => {
        this.ebmlDecoder.write(Buffer.from(arrayBuffer))
        this.counts.packets += 1
        this.counts.bytes += arrayBuffer.byteLength
        this.writeInProgress--
        if (this.writeInProgress <= 0 && this.endDeferred) {
          this.end()
        }
      })
      .catch(e => {
        throw new Error(e)
      })
  }

  end () {
    if (this.writeInProgress > 0) {
      this.endDeferred = true
    } else {
      this.endDeferred = false
      try {
        this.ebmlDecoder.end()
      } catch (e) {
        throw new Error(e)
      }
    }
  }

  deboxed (chunk) {
    const name = chunk[1].name
    if (chunk[0] === 'start') this.webmPath.push(name)
    else if (chunk[0] === 'end') this.webmPath.pop()
    else if (chunk[0] === 'tag') {
      const pathname = this.webmPath.join('.') + '.' + name
      switch (name) {

        case 'SimpleBlock':
          this.counts.blocks += 1
          this.handlePayload(chunk[1])
          break
        case 'PixelWidth':
          const val = chunk[1].value
          this.webmValues[pathname] = val - val % 2
          break
        case 'PixelHeight':
          this.webmValues[pathname] = chunk[1].value
          break
        case 'TimecodeScale':
          /* in webm, this value is in nanoseconds per clock tick
           * and we want it in milliseconds */
          this.timecodeScale = 1_000_000 / chunk[1].value
          this.webmValues[pathname] = chunk[1].value
          break
        case 'Timecode':
          /* the cluster timecode */
          this.clusterTimecode = chunk[1].value
          this.webmValues[pathname] = chunk[1].value
          break
        default:
          if (chunk[1].value)
            this.webmValues[pathname] = chunk[1].value

      }
    }
  }

  /**
   * this is provided as a way to terminate tests.
   */
  deboxEnd () {
    if (typeof this.onfinish === 'function') this.onfinish(this.counts)
  }

  handlePayload (box) {
    const localTimestamp = box.value
    const timestamp = (localTimestamp + this.clusterTimecode) * this.timecodeScale

    const naluStream = new h264tools.NALUStream(box.payload, this.decoderOptions)

    if (this.firstPayload) {
      /* save stream options so NALUStream does not have to
       * recover them by inspecting the stream each time. */
      this.decoderOptions.boxSize = naluStream.boxSize
      this.decoderOptions.type = naluStream.type
    }
    naluStream.convertToPacket()

    const options = {
      width: this.webmValues['Tracks.TrackEntry.Video.PixelWidth'],
      height: this.webmValues['Tracks.TrackEntry.Video.PixelHeight'],
      timeScale: 1000,
      trackId: 1
    }
    if (this.firstPayload) {
      options.codecPrivate = new h264tools.AvcC({ naluStream: naluStream }).avcC
      /* ftyp / moov output */
      fmp4.ftyp(this.streamBox)
      fmp4.moov(this.streamBox, options,
        (parent, options) => {
          fmp4.trakVideo(parent, options)
        },
        (parent, options) => {
          /* make each trackextension in turn, we only have one video track here. */
          options.trackId = 1
          fmp4.trexVideo(parent, options)
        }
      )
      this.firstPayload = false
    }
    const duration = Math.max(1, timestamp - this.previousSampleTime)
    fmp4.frame(this.streamBox, options, timestamp, 75, naluStream.buf)
    this.previousSampleTime = timestamp
    this.streamBox.requestData()
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    MediaTransboxer
  }
}