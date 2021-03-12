'use static'

const Blob = require('cross-blob')

/**
 * Translate webm files to fragmented MP4 version 0 files
 * a/k/a QuickTime files.
 * See https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap1/qtff1.html
 */
class Box {
  /**
   * Construct a generic box
   * @param fourcc string fourcc name of the box
   * @param parent object parent box, or null
   * @param options object
   */
  constructor (fourcc, parent, options) {
    if (!options) options = {}
    const initialSize = options.initialSize || 8192
    const type = options.type || ''
    this.p = {}
    this.p.buffer = new Uint8Array(initialSize + 8)
    this.p.max = this.p.buffer.byteLength
    this.p.ended = false
    this.p.ptr = 0
    this.p.type = type
    this.p.parent = parent
    if (this.p.parent) {
      /* leave room for the length */
      this.p.ptr = 4
      /* spit out the box name */
      this.fourcc(fourcc, 'box name')
    }
    this.p.length = 0
    this.p.childCount = 0
  }

  length () {
    return this.p.length
  }

  uint8 (item, desc) {
    let len
    if (typeof item === 'number') len = 1
    else if (item.buffer &&
      item.buffer instanceof ArrayBuffer &&
      typeof item.BYTES_PER_ELEMENT === 'number') len = item.byteLength
    else throw new Error('cannot identify item type')

    if (this.p.ptr + len >= this.p.max) {
      /* will overrun, reallocate */
      const newLength = Math.floor(this.p.buffer.byteLength * 1.5) + len
      const newBuff = new Uint8Array(newLength)
      newBuff.set(this.p.buffer)
      this.p.buffer = newBuff
      this.p.max = this.p.buffer.byteLength
    }
    if (len === 1) {
      this.p.buffer[this.p.ptr++] = item
      this.p.length++
    } else if (len > 1) {
      this.p.buffer.set(item, this.p.ptr)
      this.p.ptr += len
      this.p.length++
    }
    return this
  }

  fourcc (item, desc) {
    if (Array.isArray(item)) {
      for (let i = 0; i < item.length; i++) this.fourccstr(item[i], desc)
    } else this.fourccstr(item, desc)
    return this
  }

  fourccstr (item, desc) {
    if (typeof item !== 'string' || item.length !== 4) { throw new Error('bad fourcc') }
    for (let i = 0; i < 4; i++) this.uint8(item.charCodeAt(i))
    return this
  }

  uint16 (value, desc) {
    this.uint8(0xff & (value >> 8))
    this.uint8(0xff & value)
    return this
  }

  /**
   * write a 32-bit unsigned int
   * @param value
   * @param desc
   * @returns {Box}
   */
  uint32 (value, desc) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        this.uint32(value[i], desc)
      }
    } else {
      this.uint8(0xff & (value >> 24))
      this.uint8(0xff & (value >> 16))
      this.uint8(0xff & (value >> 8))
      this.uint8(0xff & value)
    }
    return this
  }

  /**
   * write a null-terminated string
   * @param value
   * @param desc
   */
  cString (value, desc) {
    for (let i = 0; i < value.length; i++) {
      this.uint8(value.charCodeAt(i))
    }
    this.uint8(0)
  }

  /**
   * write an unsigned 32-bit integer at the mentioned ptr offset
   * @param value to write
   * @param ptr location
   * @param desc
   */
  uint32At (value, ptr, desc) {
    this.p.buffer[ptr++] = 0xff && (value >> 24)
    this.p.buffer[ptr++] = 0xff && (value >> 16)
    this.p.buffer[ptr++] = 0xff && (value >> 8)
    this.p.buffer[ptr++] = 0xff && (value)
  }

  /**
   * write a fixed point number, split 16:16
   * @param value
   * @param desc
   * @returns {Box}
   */
  ufixed32 (value, desc) {
    const iPart = Math.floor(value)
    const fPart = Math.floor((value - iPart) << 16)
    this.uint16(iPart)
    this.uint16(fPart)
    return this
  }

  zeros (count, desc) {
    for (let i = 0; i < count; i++) {
      this.uint8(0)
    }
    return this
  }

  /**
   *
   * @returns {Box}
   */
  populate (_) {
    return this
  }

  /**
   * insert a completed child object
   * @param child
   */
  addchild (child) {
    this.p.childCount++
    this.uint8(child.p.buffer.subarray(0, child.p.ptr))
  }

  end () {
    if (this.p.ended) throw new Error('cannot end() an atom more than once')
    this.p.ended = true
    if (!this.p.parent) {
      if (typeof this.ondataavailable === 'function') {
        // eslint-disable-next-line no-undef
        const data = new Blob([this.p.buffer.subarray(0, this.p.ptr)], { type: this.p.type })
        this.ondataavailable({ data })
      }
      this.p.ptr = 0
      this.p.length = 0
    } else {
      /* child item, write the length into the box */
      this.uint32At(this.p.ptr, 0, 'length')
      /* write the box into the parent box */
      this.p.parent.addchild(this)
      /* reset this atom for possible reuse */
      this.p.ptr = 0
      this.p.length = 0
      return this
    }
  }

  /**
   * peek at the current atom data (for testing, etc)
   * @returns {Uint8Array} a copy of the current atom data
   */
  peek () {
    const peekBuff = new Uint8Array(this.p.buffer.slice(0, this.p.ptr))
    if (this.p.parent) {
      let ptr = 0
      const length = this.p.ptr
      peekBuff[ptr++] = 0xff && (length >> 24)
      peekBuff[ptr++] = 0xff && (length >> 16)
      peekBuff[ptr++] = 0xff && (length >> 8)
      peekBuff[ptr++] = 0xff && (length)
    }
    return peekBuff
  }

  static makeArray (str) {
    if (typeof str !== 'string') str = str.join(' ')
    return new Uint8Array(str.match(/[\da-f]{2} */gi).map(s => parseInt(s, 16)))
  }
}

class StreamBox extends Box {
  flush () {
    if (typeof this.ondataavailable === 'function') {
      // eslint-disable-next-line no-undef
      const data = new Blob([this.p.buffer.subarray(0, this.p.ptr)], { type: this.p.type })
      this.ondataavailable({ data })
    }
    this.p.ptr = 0
    this.p.length = 0
  }
}

class PureContainer extends Box {
}

class CountedContainer extends Box {
  itemCountPlaceholder () {
    this.p.itemCountPtr = this.p.ptr
    this.uint32(0, 'item count placeholder')
  }

  end () {
    if (typeof this.p.itemCountPtr !== 'number') {
      throw new Error('no item count placeholder')
    }
    this.uint32At(this.p.childCount, this.p.itemCountPtr, 'child count')
    super.end()
  }
}

class FtypAtom extends Box {
  constructor (parent, _) {
    super('ftyp', parent, {})
  }

  populate (options) {
    this.fourcc('mp42', 'major_brand')
    this.uint32(1, 'minor_version')
    this.fourcc(['isom', 'mp42', 'avc1'], 'compatible_brand')
    return this
  }
}

class MoovAtom extends PureContainer {
  constructor (parent, options) {
    super('moov', parent, {})
  }
}

class MvhdAtom extends Box {
  constructor (parent, options) {
    super('mvhd', parent, { initialSize: 120 })
  }

  populate ({
    creationTime = 0,
    modificationTime = 0,
    timeScale = 1000,
    duration = 0,
    rate = 0x00010000,
    volume = 0x0100,
    nextTrack = 0xffffffff
  }) {
    this.uint32(0, 'flags')
    this.uint32(creationTime, 'creationTime')
    this.uint32(modificationTime, 'notificationTime')
    this.uint32(timeScale, 'timeScale')
    this.uint32(duration)
    this.uint32(rate)
    this.uint16(volume)
    this.zeros(2, 'reserved1')
    this.zeros(8, 'reserved2')
    this.uint32([0x00010000, 0, 0], 'matrix')
    this.uint32([0, 0x00010000, 0])
    this.uint32([0, 0, 0x40000000])
    this.zeros(24, 'predefined')
    this.uint32(nextTrack, 'nextTrack')
    return this
  }
}

class TrakAtom extends PureContainer {
  constructor (parent, options) {
    super('trak', parent, { initialSize: 500 })
  }
}

class TkhdAtom extends Box {
  constructor (parent, options) {
    super('tkhd', parent, { initialSize: 100 })
  }

  populate ({
    trackEnabled = true,
    trackInMovie = true,
    trackInPreview = true,
    creationTime = 0,
    modificationTime = 0,
    trackId,
    duration = 0,
    layer = 0,
    alternate = 0,
    volume = 0,
    width,
    height
  }) {
    const flags =
      (trackEnabled ? 1 : 0) | ((trackInMovie ? 1 : 0) << 1) | ((trackInPreview ? 1 : 0) << 2)
    this.uint32(flags, 'flags')
    this.uint32(creationTime, 'creationTime')
    this.uint32(modificationTime, 'notificationTime')
    this.uint32(trackId, 'trackId')
    this.uint32(0, 'reserved1')
    this.uint32(duration, 'duration')
    this.uint32(0, 'reserved2')
    this.uint32(0, 'reserved2')
    this.uint16(layer, 'layer')
    this.uint16(alternate, 'alternate')
    this.uint16(volume, 'volume')
    this.uint16(0, 'reserved3')
    this.uint32([0x00010000, 0, 0], 'matrix')
    this.uint32([0, 0x00010000, 0])
    this.uint32([0, 0, 0x40000000])
    this.ufixed32(width, 'width')
    this.ufixed32(height, 'height')
    return this
  }
}

class MdiaAtom extends PureContainer {
  constructor (parent, options) {
    super('mdia', parent, { initialSize: 400 })
  }
}

class MdhdAtom extends Box {
  constructor (parent, options) {
    super('mdhd', parent, { initialSize: 32 })
  }

  populate ({
    creationTime = 0,
    modificationTime = 0,
    timeScale,
    duration = 0
  }) {
    this.uint32(0, 'flags')
    this.uint32(creationTime, 'creationTime')
    this.uint32(modificationTime, 'notificationTime')
    this.uint32(timeScale, 'timeScale')
    this.uint32(duration, 'duration')
    this.uint16(0x15e0, 'language') // TODO this is dummy language value ```
    this.uint16(0, 'reserved')

    return this
  }
}

/**
 * "The media handler component that is to be used to interpret the media’s data."
 */
class HdlrAtom extends Box {
  constructor (parent, options) {
    super('hdlr', parent, { initialSize: 60 })
  }

  populate ({
    type = 'vide',
    name = 'web2mp4-js'
  }) {
    this.uint32(0, 'flags')
    this.uint32(0, 'reserved')
    this.fourcc(type, 'type')
    this.zeros(12, 'reserved')
    this.cString(name)
    return this
  }
}

/**
 * Media Information atom
 */
class MinfAtom extends PureContainer {
  constructor (parent, options) {
    super('minf', parent, { initialSize: 350 })
  }
}

/**
 * What is this?
 * See https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-33012
 */
class VmhdAtom extends Box {
  constructor (parent, options) {
    super('vmhd', parent, { initialSize: 20 })
  }

  populate ({ graphicsMode = 0, opColor0 = 0, opColor1 = 0, opColor2 = 0 }) {
    this.uint32(1, 'flags')
    this.uint16(graphicsMode, 'graphics transfer mode')
    this.uint16(opColor0, 'opColor0 red')
    this.uint16(opColor1, 'opColor1 green')
    this.uint16(opColor2, 'opColor2 blue')
    return this
  }
}

/**
 * Data information atom
 * TODO this is a stub with a single dref containing a single null URL
 */
class DinfAtom extends Box {
  constructor (parent, _) {
    super('dinf', parent, { initialSize: 50 })
  }

  populate (_) {
    this.uint32(28, 'size')
    this.fourcc('dref')
    this.uint32(0, 'flags')
    this.uint32(1, 'number of references')
    this.uint32(12, 'size of empty URL item')
    this.fourcc('url ')
    this.uint32(1, 'flag')
    return this
  }
}

/**
 * Media Information atom
 */
class StblAtom extends PureContainer {
  constructor (parent, options) {
    super('stbl', parent, { initialSize: 250 })
  }
}

/**
 *
 */
class StsdAtom extends CountedContainer {
  constructor (parent, options) {
    super('stsd', parent, { initialSize: 150 })
  }

  populate (options) {
    this.uint32(0, 'flags')
    this.itemCountPlaceholder()
    return this
  }
}

class Avc1Atom extends Box {
  constructor (parent, options) {
    super('avc1', parent, { initialSize: 150 })
  }

  populate (
    {
      width,
      height,
      dataReferenceIndex = 1,
      compressor = 'h264'
    }) {
    this.uint32(0, 'reserved')
    this.uint32(dataReferenceIndex, 'data reference index')
    this.zeros(16, '??')
    this.uint16(width, 'width')
    this.uint16(height, 'height')
    this.uint32(0x00480000, 'horizResolution')
    this.uint32(0x00480000, 'VertResolution')
    this.uint32(0, '???')
    this.uint16(1, '???')
    this.uint8(4)
    this.cString(compressor, 'compressor')
    this.zeros(27, '???')
    this.uint8(0x18, '???')
    this.uint16(0xffff, '???')
    return this
  }
}

class AvcCAtom extends Box {
  constructor (parent, options) {
    super('avcC', parent, { initialSize: 60 })
  }

  populate ({ codecPrivate }) {
    this.uint8(codecPrivate, 'codec private data')
    return this
  }
}

class StszAtom extends Box {
  constructor (parent, options) {
    super('stsz', parent, { initialSize: 20 })
  }

  populate ({ sampleSize = 0 }) {
    this.uint32(0, 'flags')
    this.uint32(sampleSize, 'sampleSize')
    /* TODO this doesn't handle a non-empty sample size table. */
    this.uint32(0, 'sample size table count')
    return this
  }
}

class EmptyTableContainer extends Box {
  constructor (fourcc, parent, options) {
    super(fourcc, parent, { initialSize: 16 })
  }

  populate (_) {
    this.uint32(0, 'flags')
    this.uint32(0, 'entry count')
    return this
  }
}

class StscAtom extends EmptyTableContainer {
  constructor (parent, options) {
    super('stsc', parent, { initialSize: 16 })
  }
}

class SttsAtom extends EmptyTableContainer {
  constructor (parent, options) {
    super('stts', parent, { initialSize: 16 })
  }
}

class StcoAtom extends EmptyTableContainer {
  constructor (parent, options) {
    super('stco', parent, { initialSize: 16 })
  }
}

/**
 * Movie Extends box (for fragmented)
 */
class MvexAtom extends PureContainer {
  constructor (parent, options) {
    super('mvex', parent, { initialSize: 56 })
  }
}

/**
 * Movie Extends Header (for fragmented)
 */
class MehdAtom extends Box {
  constructor (parent, options) {
    super('mehd', parent, { initialSize: 16 })
  }

  populate ({ duration = 0 }) {
    this.uint32(0, 'flags')
    this.uint32(duration, 'duration')
    return this
  }
}

/**
 * Track Extends header
 */
class TrexAtom extends Box {
  constructor (parent, options) {
    super('trex', parent, { initialSize: 32 })
  }

  populate ({
    trackId,
    sampleDescriptionIndex = 1,
    defaultSampleDuration = 0,
    defaultSampleSize = 0,
    defaultSampleFlags = 0
  }) {
    this.uint32(0, 'flags')
    this.uint32(trackId, 'track id')
    this.uint32(sampleDescriptionIndex, 'sample description index')
    this.uint32(defaultSampleDuration, 'default sample duration')
    this.uint32(defaultSampleSize, 'default sample size')
    this.uint32(defaultSampleFlags, 'default sample flags')
    return this
  }
}

/**
 * Movie Fragment atom
 * See https://www.w3.org/2013/12/byte-stream-format-registry/isobmff-byte-stream-format.html#iso-media-segments
 */
class MoofAtom extends PureContainer {
  constructor (parent, options) {
    super('moof', parent, { initialSize: 110 })
  }
}

/**
 * Movie fragment header box, to contain sequence number
 */
class MfhdAtom extends Box {
  constructor (parent, options) {
    super('mfhd', parent, { initialSize: 16 })
  }

  /**
   * Each moof / mfhd must have a new sequence number
   * @param sequenceNumber
   * @returns {MfhdAtom}
   */
  populate ({ sequenceNumber }) {
    this.uint32(0, 'flags')
    this.uint32(sequenceNumber, 'sequence number')
    return this
  }
}

/**
 * Track Fragment Box
 */
class TrafAtom extends PureContainer {
  constructor (parent, options) {
    super('traf', parent, { initialSize: 90 })
  }
}

/**
 * Track Fragment Header
 */
class TfhdAtom extends Box {
  constructor (parent, options) {
    super('tfhd', parent, { initialSize: 20 })
  }

  populate ({ trackId, flags = 0x20020, defaultSampleFlags = 0x1010000 }) {
    this.uint32(flags, 'flags')
    this.uint32(trackId, 'track id')
    this.uint32(defaultSampleFlags, 'default sample flags')
    return this
  }
}

/**
 * Track Fragment Decode Time
 */
class TfdtAtom extends Box {
  constructor (parent, options) {
    super('tfdt', parent, { initialSize: 20 })
  }

  /**
   * set the track fragment decoode time.
   * @param baseMediaDecodeTimeHigh High order... often zero
   * @param baseMediaDecodeTime  Some number of milliseconds
   * @returns {TfdtAtom}
   */
  populate ({ baseMediaDecodeTimeHigh = 0, baseMediaDecodeTime }) {
    this.uint8(1, 'version')
    this.zeros(3, 'flags')
    this.uint32(baseMediaDecodeTimeHigh, 'high order base media decode time')
    this.uint32(baseMediaDecodeTime, 'base media decode time')
    return this
  }
}

class TrunAtom extends Box {
  constructor (parent, options) {
    super('trun', parent, { initialSize: 32 })
  }

  populate ({
    flags = 0x305,
    sampleCount = 1,
    dataOffset,
    firstSampleFlags = 2000000,
    sampleDuration,
    sampleSize
  }) {
    this.uint32(flags, 'flags')
    this.uint32(sampleCount, 'sample count')
    this.uint32(dataOffset, 'data offset') // TODO can we generate this?
    this.uint32(sampleDuration, 'sample duration')
    this.uint32(sampleSize, 'sample size, payload length of next mdat')

    return this
  }
}

class MdatAtom extends Box {
  constructor (parent, options) {
    super('mdat', parent, { initialSize: 4096 })
  }

  populate ({ payload }) {
    this.uint8(payload, 'payload')
    return this
  }
}

/**
 * helper function to create ftyp atom
 * @param streamBox
 * @param options
 * @returns {FtypAtom|undefined}
 */
function ftyp (streamBox, options) {
  return new FtypAtom(streamBox).populate().end()
}

function moov (streamBox, options, makeTracks, makeTrackExtensions) {
  const { timeScale } = options

  const moov = new MoovAtom(streamBox)
  new MvhdAtom((moov)).populate({ timeScale }).end()
  makeTracks(moov, options)
  /* Track Extensions (for fragmented) */
  const mvex = new MvexAtom(moov).populate()
  new MehdAtom(moov).populate(options).end()
  makeTrackExtensions(mvex, options)
  mvex.end()
  moov.end()
}

/**
 * helper function to create and populate a trak atom for video
 * @param parent
 * @param width
 * @param height
 * @param trackId
 * @param timeScale
 * @param name
 * @param codecPrivate
 * @returns {*}
 */
function trakVideo (parent,
  { width, height, trackId = 2, timeScale, name = 'web2mp4-js', codecPrivate }
) {
  const trak = new TrakAtom(parent)
  {
    /* tkhd */
    new TkhdAtom(trak).populate({ width, height, trackId }).end()
    /* mdia and subatoms */
    const mdia = new MdiaAtom(trak)
    {
      mdia.populate({})
      new MdhdAtom(mdia).populate({ timeScale }).end()
      /* hdlr */
      new HdlrAtom(mdia).populate({ name }).end()
      /* minf -- media information */
      const minf = new MinfAtom(mdia)
      {
        /* video media information */
        new VmhdAtom(minf).populate({}).end()
        /* Data information (stub) */
        new DinfAtom(minf).populate().end()
        /* sample table ... description of the media */
        const stbl = new StblAtom(minf)
        {
          stbl.populate({})
          const stsd = new StsdAtom(stbl)
          stsd.populate({})
          const avc1 = new Avc1Atom(stsd)
          avc1.populate({ width, height })
          new AvcCAtom(avc1).populate({ codecPrivate }).end()
          avc1.end()
          stsd.end()
          new StszAtom(stbl).populate({}).end()
          new StscAtom(stbl).populate({}).end()
          new SttsAtom(stbl).populate({}).end()
          new StcoAtom(stbl).populate({}).end()
        }
        stbl.end()
      }
      minf.end()
    }
    mdia.end()
  }
  trak.end()
  return parent
}

/**
 * helper function to create trex (track extension)
 * @param streamBox
 * @param trackId
 */
function trexVideo (streamBox, { trackId }) {
  const mvex = new MvexAtom(streamBox)
  new MehdAtom(mvex).populate({}).end()
  new TrexAtom(mvex).populate({ trackId }).end()
  mvex.end()
}

if (typeof module !== 'undefined') {
  module.exports =
    {
      ftyp,
      moov,
      trakVideo,
      trexVideo,
      Box,
      StreamBox,
      FtypAtom,
      MoovAtom,
      MvhdAtom,
      TrakAtom,
      TkhdAtom,
      MdiaAtom,
      MdhdAtom,
      HdlrAtom,
      MinfAtom,
      VmhdAtom,
      DinfAtom,
      StblAtom,
      StsdAtom,
      Avc1Atom,
      AvcCAtom,
      StszAtom,
      StscAtom,
      SttsAtom,
      StcoAtom,
      MvexAtom,
      MehdAtom,
      TrexAtom,
      MoofAtom,
      MfhdAtom,
      TrafAtom,
      TfhdAtom,
      TfdtAtom,
      TrunAtom,
      MdatAtom

    }
}
