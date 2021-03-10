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
  populate (options) {
    return this
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
      let ptr = 0
      const length = this.p.ptr
      this.p.buffer[ptr++] = 0xff && (length >> 24)
      this.p.buffer[ptr++] = 0xff && (length >> 16)
      this.p.buffer[ptr++] = 0xff && (length >> 8)
      this.p.buffer[ptr++] = 0xff && (length)
      /* write the box into the parent box */
      this.p.parent.uint8(this.p.buffer.subarray(0, this.p.ptr))
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

class PureContainer extends Box {
}

class FtypAtom extends Box {
  constructor (parent, _) {
    super('ftyp', parent, {})
  }

  populate (options) {
    super.fourcc('mp42', 'major_brand')
    super.uint32(1, 'minor_version')
    super.fourcc(['isom', 'mp42', 'avc1'], 'compatible_brand')
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
    super.uint32(0, 'flags')
    super.uint32(creationTime, 'creationTime')
    super.uint32(modificationTime, 'notificationTime')
    super.uint32(timeScale, 'timeScale')
    super.uint32(duration)
    super.uint32(rate)
    super.uint16(volume)
    super.zeros(2, 'reserved1')
    super.zeros(8, 'reserved2')
    super.uint32([0x00010000, 0, 0], 'matrix')
    super.uint32([0, 0x00010000, 0])
    super.uint32([0, 0, 0x40000000])
    super.zeros(24, 'predefined')
    super.uint32(nextTrack, 'nextTrack')
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
    super.uint32(flags, 'flags')
    super.uint32(creationTime, 'creationTime')
    super.uint32(modificationTime, 'notificationTime')
    super.uint32(trackId, 'trackId')
    super.uint32(0, 'reserved1')
    super.uint32(duration, 'duration')
    super.uint32(0, 'reserved2')
    super.uint32(0, 'reserved2')
    super.uint16(layer, 'layer')
    super.uint16(alternate, 'alternate')
    super.uint16(volume, 'volume')
    super.uint16(0, 'reserved3')
    super.uint32([0x00010000, 0, 0], 'matrix')
    super.uint32([0, 0x00010000, 0])
    super.uint32([0, 0, 0x40000000])
    super.ufixed32(width, 'width')
    super.ufixed32(height, 'height')
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
    super.uint32(0, 'flags')
    super.uint32(creationTime, 'creationTime')
    super.uint32(modificationTime, 'notificationTime')
    super.uint32(timeScale, 'timeScale')
    super.uint32(duration, 'duration')
    super.uint16(0x15e0, 'language') // TODO this is dummy language value ```
    super.uint16(0, 'reserved')

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
    name = 'WebM Transboxer'
  }) {
    super.uint32(0, 'flags')
    super.uint32(0, 'reserved')
    super.fourcc(type, 'type')
    super.zeros(12, 'reserved')
    for (let i = 0; i < name.length; i++) {
      this.uint8(name.charCodeAt(i))
    }
    super.uint8(0, 'c string null terminator')
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
    super.uint32(1, 'flags')
    super.uint16(graphicsMode, 'graphics transfer mode')
    super.uint16(opColor0, 'opColor0 red')
    super.uint16(opColor1, 'opColor1 green')
    super.uint16(opColor2, 'opColor2 blue')
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
    super.uint32(28, 'size')
    super.fourcc('dref')
    super.uint32(0, 'flags')
    super.uint32(1, 'number of references')
    super.uint32(12, 'size of empty URL item')
    super.fourcc('url ')
    super.uint32(1, 'flag')
    return this
  }
}

/**
 * Media Information atom
 */
class StblAtom extends PureContainer {
  constructor (parent, options) {
    super('minf', parent, { initialSize: 250 })
  }
}

/**
 *
 */
class StsdAtom extends Box {
  constructor (parent, _) {
    super('vmhd', parent, { initialSize: 150 })
  }

  populate (options) {
    super.uint32(0, 'flags')
    return this
  }
}

if (typeof module !== 'undefined') {
  module.exports =
    {
      Box,
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
      StsdAtom

    }
}
