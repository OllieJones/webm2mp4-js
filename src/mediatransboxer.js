import * as h264tools from 'h264-interp-utils'
import { Decoder } from 'ebml'
import * as fmp4 from '../src/box.js'

class MediaTransboxer {

  ondataavailable = function (event) { /* stub */}
  firstPayload = true
  decoderOptions = {}
  type = 'video/mp4 codecs="avc1.42C01E"'

  constructor (options) {
    if (!options) options = {}
    if (typeof options.ondataavailable === 'function')
      this.ondataavailable = options.ondataavailable
    if (typeof options.type === 'string')
      this.type = options.type
    this.streamBuf = new fmp4.Box(null, null, { type: this.type })
    this.ebmlDecoder = new Decoder()
    this.ebmlDecoder.on('data', this.debox)
  }

  /**
   * write a buffer to the decoder
   * @param buffer
   */
  writeBuffer (buffer) {
    this.ebmlDecoder.write(buffer)
  }

  /**
   * This function is useful as
   * ondataavailable for MediaRecorder
   * @param event
   */
  write (event) {
    if (!this.streamBuf) {
    }

    this.#doEvent(event).then().catch(err => throw new Error(err.message))
  }

  async #doEvent (event) {
    const data = event.data
    const payload = await event.data.arrayBuffer()
    this.ebmlDecoder.write(payload)
  }

  deboxed (chunk) {
    const name = chunk[1].name
    if (chunk[0] === 'tag') {
      switch (name) {

        case 'SimpleBlock':
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
      /* ftyp / moov output */
      const avcC = new h264tools.AvcC({ naluStream: naluStream })

      this.firstPayload = false
    }
  }
}