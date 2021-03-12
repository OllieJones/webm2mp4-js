import * as h264tools from 'h264-interp-utils'
import { Decoder } from 'ebml'
import * as fmp4 from '../src/box.js'

class MediaTransboxer {

  ondataavailable = function (ev) { /* stub */}
  onfinish = function (ev) { /* stub */}
  firstPayload = true
  decoderOptions = {}
  type = 'video/mp4 codecs="avc1.42C01E"'
  counts = { packets: 0, bytes: 0, blocks: 0 }

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
  }

  /**
   * write a buffer to the decoder
   * @param buffer
   */
  writeBuffer (buffer) {
    this.counts.packets += 1
    this.counts.bytes += buffer.byteLength
    this.ebmlDecoder.write(buffer)
  }

  /**
   * This function is useful as
   * ondataavailable for MediaRecorder
   * @param event
   */
  write (event) {
    event.data.arrayBuffer()
      .then(payload => {
        this.ebmlDecoder.write(payload)
        this.counts.packets += 1
        this.counts.bytes += payload.byteLength
      })
      .catch(e => {
        throw new Error(e)
      })
  }

  end () {
    this.ebmlDecoder.end()
  }

  deboxed (chunk) {
    const name = chunk[1].name
    if (chunk[0] === 'tag') {
      switch (name) {

        case 'SimpleBlock':
          this.counts.blocks += 1
          this.handlePayload(chunk[1].payload)
          break
        case 'PixelWidth':
          const val = chunk[1].value
          this[name] = val - val % 2
          break
        case 'PixelHeight':
        case 'TimecodeScale':
        case 'Timecode':
          this[name] = chunk[1].value
          break
      }
    }
  }

  /**
   * this is provided as a way to terminate tests.
   */
  deboxEnd () {
    if (typeof this.onfinish === 'function') this.onfinish(this.counts)
  }

  handlePayload (payload) {
    const naluStream = new h264tools.NALUStream(payload, this.decoderOptions)

    if (this.firstPayload) {
      /* save stream options so NALUStream does not have to
       * recover them by inspecting the stream each time. */
      this.decoderOptions.boxSize = naluStream.boxSize
      this.decoderOptions.type = naluStream.type
    }
    naluStream.convertToPacket()

    if (this.firstPayload) {
      const codecPrivateData = new h264tools.AvcC({ naluStream: naluStream })
      const options = {
        height: this.PixelHeight,
        width: this.PixelWidth,
        codecPrivate: codecPrivateData.avcC
      }
      /* ftyp / moov output */
      fmp4.ftyp(this.streamBox)
      fmp4.moov(this.streamBox, options,
        (parent, options) => {
          /* make each track in turn, we only have video here. */
          options.trackId = 1
          fmp4.trakVideo(parent, options)
        },
        (parent, options) => {
          /* make each trackextension in turn, we only have video here. */
          options.trackId = 1
          fmp4.trexVideo(parent, options)
        }
      )
      this.streamBox.flush()

      this.firstPayload = false
    }
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    MediaTransboxer
  }
}