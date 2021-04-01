module.exports = (function () {
  function EbmlDecoder (options) {
    // noinspection JSUnusedAssignment
    /** ********* constructor ***************/
    options = options || {}

    // var debug = console.log;
    const debug = function () {
    }

    const STATE_TAG = 1
    const STATE_SIZE = 2
    const STATE_CONTENT = 3

    const self = this

    self._buffer = null
    self._tag_stack = []
    self._state = STATE_TAG
    self._cursor = 0
    self._total = 0
    self._writecount = 0

    EbmlDecoder.prototype.reset = function () {
      self._buffer = null
      self._tag_stack = []
      self._state = STATE_TAG
      self._cursor = 0
      self._total = 0
      self._writecount = 0
    }

    EbmlDecoder.prototype.write = function (chunk, callback) {
      self._callback = callback

      self._writecount++
      if (self._buffer === null) {
        self._buffer = new Uint8Array(chunk)
      } else {
        self._buffer = tools.concatenate(self._buffer, new Uint8Array(chunk))
      }

      while (self._cursor < self._buffer.length) {
        if (self._state === STATE_TAG && !self.readTag()) {
          break
        }
        if (self._state === STATE_SIZE && !self.readSize()) {
          break
        }
        if (self._state === STATE_CONTENT && !self.readContent()) {
          break
        }
      }
    }

    EbmlDecoder.prototype.getSchemaInfo = function (tagStr) {
      return self._schema[tagStr] || {
        type: 'unknown',
        name: 'unknown'
      }
    }

    EbmlDecoder.prototype.readTag = function () {
      debug('parsing tag')

      if (self._cursor >= self._buffer.length) {
        debug('waiting for more data')
        return false
      }

      const start = self._total
      const tag = tools.readVint(self._buffer, self._cursor)

      if (tag == null) {
        debug('waiting for more data')
        return false
      }

      const tagStr = tools.readHexString(self._buffer, self._cursor, self._cursor + tag.length)
      self._cursor += tag.length
      self._total += tag.length
      self._state = STATE_SIZE

      const tagObj = {
        tag: tag.value,
        tagStr: tagStr,
        type: self.getSchemaInfo(tagStr).type,
        name: self.getSchemaInfo(tagStr).name,
        start: start,
        end: start + tag.length
      }

      self._tag_stack.push(tagObj)
      debug('read tag: ' + tagStr)

      return true
    }

    EbmlDecoder.prototype.readSize = function () {
      const tagObj = self._tag_stack[self._tag_stack.length - 1]

      debug('parsing size for tag: ' + tagObj.tag.toString(16))

      if (self._cursor >= self._buffer.length) {
        debug('waiting for more data')
        return false
      }

      const size = tools.readVint(self._buffer, self._cursor)

      if (!size) {
        debug('waiting for more data')
        return false
      }

      self._cursor += size.length
      self._total += size.length
      self._state = STATE_CONTENT
      tagObj.dataSize = size.value

      // unknown size
      if (size.value === -1) {
        tagObj.end = -1
      } else {
        tagObj.end += size.value + size.length
      }

      debug('read size: ' + size.value)

      return true
    }

    EbmlDecoder.prototype.readContent = function () {
      const tagObj = self._tag_stack[self._tag_stack.length - 1]

      debug('parsing content for tag: ' + tagObj.tag.toString(16))

      if (tagObj.type === 'm') {
        debug('content should be tags')
        self._callback(['start', tagObj])
        self._state = STATE_TAG
        return true
      }

      if (self._buffer.length < self._cursor + tagObj.dataSize) {
        debug('got: ' + self._buffer.length)
        debug('need: ' + (self._cursor + tagObj.dataSize))
        debug('waiting for more data')
        return false
      }

      const data = self._buffer.subarray(self._cursor, self._cursor + tagObj.dataSize)
      self._total += tagObj.dataSize
      self._state = STATE_TAG
      self._buffer = self._buffer.subarray(self._cursor + tagObj.dataSize)
      self._cursor = 0

      self._tag_stack.pop() // remove the object from the stack
      self._callback(['tag', tools.readDataFromTag(tagObj, data)])

      while (self._tag_stack.length > 0) {
        const topEle = self._tag_stack[self._tag_stack.length - 1]
        if (self._total < topEle.end) {
          break
        }
        self._callback(['end', topEle])
        self._tag_stack.pop()
      }

      debug('read data: ' + tools.readHexString(data))
      return true
    }
    EbmlDecoder.prototype.schema = {
      80: {
        name: 'ChapterDisplay',
        level: '4',
        type: 'm',
        multiple: '1',
        minver: '1',
        webm: '1'
      },
      83: {
        name: 'TrackType',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        range: '1-254'
      },
      85: {
        name: 'ChapString',
        cppname: 'ChapterString',
        level: '5',
        type: '8',
        mandatory: '1',
        minver: '1',
        webm: '1'
      },
      86: {
        name: 'CodecID',
        level: '3',
        type: 's',
        mandatory: '1',
        minver: '1'
      },
      88: {
        name: 'FlagDefault',
        cppname: 'TrackFlagDefault',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        default: '1',
        range: '0-1'
      },
      89: {
        name: 'ChapterTrackNumber',
        level: '5',
        type: 'u',
        mandatory: '1',
        multiple: '1',
        minver: '1',
        webm: '0',
        range: 'not 0'
      },
      91: {
        name: 'ChapterTimeStart',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '1'
      },
      92: {
        name: 'ChapterTimeEnd',
        level: '4',
        type: 'u',
        minver: '1',
        webm: '0'
      },
      96: {
        name: 'CueRefTime',
        level: '5',
        type: 'u',
        mandatory: '1',
        minver: '2',
        webm: '0'
      },
      97: {
        name: 'CueRefCluster',
        level: '5',
        type: 'u',
        mandatory: '1',
        webm: '0'
      },
      98: {
        name: 'ChapterFlagHidden',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '0',
        range: '0-1'
      },
      4254: {
        name: 'ContentCompAlgo',
        level: '6',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '0',
        br: [
          '',
          '',
          '',
          ''
        ],
        del: [
          '1 - bzlib,',
          '2 - lzo1x'
        ]
      },
      4255: {
        name: 'ContentCompSettings',
        level: '6',
        type: 'b',
        minver: '1',
        webm: '0'
      },
      4282: {
        name: 'DocType',
        level: '1',
        type: 's',
        mandatory: '1',
        default: 'matroska',
        minver: '1'
      },
      4285: {
        name: 'DocTypeReadVersion',
        level: '1',
        type: 'u',
        mandatory: '1',
        default: '1',
        minver: '1'
      },
      4286: {
        name: 'EBMLVersion',
        level: '1',
        type: 'u',
        mandatory: '1',
        default: '1',
        minver: '1'
      },
      4287: {
        name: 'DocTypeVersion',
        level: '1',
        type: 'u',
        mandatory: '1',
        default: '1',
        minver: '1'
      },
      4444: {
        name: 'SegmentFamily',
        level: '2',
        type: 'b',
        multiple: '1',
        minver: '1',
        webm: '0',
        bytesize: '16'
      },
      4461: {
        name: 'DateUTC',
        level: '2',
        type: 'd',
        minver: '1'
      },
      4484: {
        name: 'TagDefault',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '1',
        range: '0-1'
      },
      4485: {
        name: 'TagBinary',
        level: '4',
        type: 'b',
        minver: '1',
        webm: '0'
      },
      4487: {
        name: 'TagString',
        level: '4',
        type: '8',
        minver: '1',
        webm: '0'
      },
      4489: {
        name: 'Duration',
        level: '2',
        type: 'f',
        minver: '1',
        range: '> 0'
      },
      4598: {
        name: 'ChapterFlagEnabled',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '1',
        range: '0-1'
      },
      4660: {
        name: 'FileMimeType',
        level: '3',
        type: 's',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      4661: {
        name: 'FileUsedStartTime',
        level: '3',
        type: 'u',
        divx: '1'
      },
      4662: {
        name: 'FileUsedEndTime',
        level: '3',
        type: 'u',
        divx: '1'
      },
      4675: {
        name: 'FileReferral',
        level: '3',
        type: 'b',
        webm: '0'
      },
      5031: {
        name: 'ContentEncodingOrder',
        level: '5',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '0'
      },
      5032: {
        name: 'ContentEncodingScope',
        level: '5',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '1',
        range: 'not 0',
        br: [
          '',
          '',
          ''
        ]
      },
      5033: {
        name: 'ContentEncodingType',
        level: '5',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '0',
        br: [
          '',
          ''
        ]
      },
      5034: {
        name: 'ContentCompression',
        level: '5',
        type: 'm',
        minver: '1',
        webm: '0'
      },
      5035: {
        name: 'ContentEncryption',
        level: '5',
        type: 'm',
        minver: '1',
        webm: '0'
      },
      5378: {
        name: 'CueBlockNumber',
        level: '4',
        type: 'u',
        minver: '1',
        default: '1',
        range: 'not 0'
      },
      5654: {
        name: 'ChapterStringUID',
        level: '4',
        type: '8',
        mandatory: '0',
        minver: '3',
        webm: '1'
      },
      5741: {
        name: 'WritingApp',
        level: '2',
        type: '8',
        mandatory: '1',
        minver: '1'
      },
      5854: {
        name: 'SilentTracks',
        cppname: 'ClusterSilentTracks',
        level: '2',
        type: 'm',
        minver: '1',
        webm: '0'
      },
      6240: {
        name: 'ContentEncoding',
        level: '4',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      6264: {
        name: 'BitDepth',
        cppname: 'AudioBitDepth',
        level: '4',
        type: 'u',
        minver: '1',
        range: 'not 0'
      },
      6532: {
        name: 'SignedElement',
        level: '3',
        type: 'b',
        multiple: '1',
        webm: '0'
      },
      6624: {
        name: 'TrackTranslate',
        level: '3',
        type: 'm',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      6911: {
        name: 'ChapProcessCommand',
        cppname: 'ChapterProcessCommand',
        level: '5',
        type: 'm',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      6922: {
        name: 'ChapProcessTime',
        cppname: 'ChapterProcessTime',
        level: '6',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      6924: {
        name: 'ChapterTranslate',
        level: '2',
        type: 'm',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      6933: {
        name: 'ChapProcessData',
        cppname: 'ChapterProcessData',
        level: '6',
        type: 'b',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      6944: {
        name: 'ChapProcess',
        cppname: 'ChapterProcess',
        level: '4',
        type: 'm',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      6955: {
        name: 'ChapProcessCodecID',
        cppname: 'ChapterProcessCodecID',
        level: '5',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '0'
      },
      7373: {
        name: 'Tag',
        level: '2',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      7384: {
        name: 'SegmentFilename',
        level: '2',
        type: '8',
        minver: '1',
        webm: '0'
      },
      7446: {
        name: 'AttachmentLink',
        cppname: 'TrackAttachmentLink',
        level: '3',
        type: 'u',
        minver: '1',
        webm: '0',
        range: 'not 0'
      },
      258688: {
        name: 'CodecName',
        level: '3',
        type: '8',
        minver: '1'
      },
      18538067: {
        name: 'Segment',
        level: '0',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1'
      },
      '447a': {
        name: 'TagLanguage',
        level: '4',
        type: 's',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: 'und'
      },
      '45a3': {
        name: 'TagName',
        level: '4',
        type: '8',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      '67c8': {
        name: 'SimpleTag',
        cppname: 'TagSimple',
        level: '3',
        recursive: '1',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      '63c6': {
        name: 'TagAttachmentUID',
        level: '4',
        type: 'u',
        multiple: '1',
        minver: '1',
        webm: '0',
        default: '0'
      },
      '63c4': {
        name: 'TagChapterUID',
        level: '4',
        type: 'u',
        multiple: '1',
        minver: '1',
        webm: '0',
        default: '0'
      },
      '63c9': {
        name: 'TagEditionUID',
        level: '4',
        type: 'u',
        multiple: '1',
        minver: '1',
        webm: '0',
        default: '0'
      },
      '63c5': {
        name: 'TagTrackUID',
        level: '4',
        type: 'u',
        multiple: '1',
        minver: '1',
        webm: '0',
        default: '0'
      },
      '63ca': {
        name: 'TargetType',
        cppname: 'TagTargetType',
        level: '4',
        type: 's',
        minver: '1',
        webm: '0',
        strong: 'informational'
      },
      '68ca': {
        name: 'TargetTypeValue',
        cppname: 'TagTargetTypeValue',
        level: '4',
        type: 'u',
        minver: '1',
        webm: '0',
        default: '50'
      },
      '63c0': {
        name: 'Targets',
        cppname: 'TagTargets',
        level: '3',
        type: 'm',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      '1254c367': {
        name: 'Tags',
        level: '1',
        type: 'm',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      '450d': {
        name: 'ChapProcessPrivate',
        cppname: 'ChapterProcessPrivate',
        level: '5',
        type: 'b',
        minver: '1',
        webm: '0'
      },
      '437e': {
        name: 'ChapCountry',
        cppname: 'ChapterCountry',
        level: '5',
        type: 's',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      '437c': {
        name: 'ChapLanguage',
        cppname: 'ChapterLanguage',
        level: '5',
        type: 's',
        mandatory: '1',
        multiple: '1',
        minver: '1',
        webm: '1',
        default: 'eng'
      },
      '8f': {
        name: 'ChapterTrack',
        level: '4',
        type: 'm',
        minver: '1',
        webm: '0'
      },
      '63c3': {
        name: 'ChapterPhysicalEquiv',
        level: '4',
        type: 'u',
        minver: '1',
        webm: '0'
      },
      '6ebc': {
        name: 'ChapterSegmentEditionUID',
        level: '4',
        type: 'u',
        minver: '1',
        webm: '0',
        range: 'not 0'
      },
      '6e67': {
        name: 'ChapterSegmentUID',
        level: '4',
        type: 'b',
        minver: '1',
        webm: '0',
        range: '>0',
        bytesize: '16'
      },
      '73c4': {
        name: 'ChapterUID',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '1',
        range: 'not 0'
      },
      b6: {
        name: 'ChapterAtom',
        level: '3',
        recursive: '1',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1',
        webm: '1'
      },
      '45dd': {
        name: 'EditionFlagOrdered',
        level: '3',
        type: 'u',
        minver: '1',
        webm: '0',
        default: '0',
        range: '0-1'
      },
      '45db': {
        name: 'EditionFlagDefault',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '0',
        range: '0-1'
      },
      '45bd': {
        name: 'EditionFlagHidden',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '0',
        range: '0-1'
      },
      '45bc': {
        name: 'EditionUID',
        level: '3',
        type: 'u',
        minver: '1',
        webm: '0',
        range: 'not 0'
      },
      '45b9': {
        name: 'EditionEntry',
        level: '2',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1',
        webm: '1'
      },
      '1043a770': {
        name: 'Chapters',
        level: '1',
        type: 'm',
        minver: '1',
        webm: '1'
      },
      '46ae': {
        name: 'FileUID',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        range: 'not 0'
      },
      '465c': {
        name: 'FileData',
        level: '3',
        type: 'b',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      '466e': {
        name: 'FileName',
        level: '3',
        type: '8',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      '467e': {
        name: 'FileDescription',
        level: '3',
        type: '8',
        minver: '1',
        webm: '0'
      },
      '61a7': {
        name: 'AttachedFile',
        level: '2',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      '1941a469': {
        name: 'Attachments',
        level: '1',
        type: 'm',
        minver: '1',
        webm: '0'
      },
      eb: {
        name: 'CueRefCodecState',
        level: '5',
        type: 'u',
        webm: '0',
        default: '0'
      },
      '535f': {
        name: 'CueRefNumber',
        level: '5',
        type: 'u',
        webm: '0',
        default: '1',
        range: 'not 0'
      },
      db: {
        name: 'CueReference',
        level: '4',
        type: 'm',
        multiple: '1',
        minver: '2',
        webm: '0'
      },
      ea: {
        name: 'CueCodecState',
        level: '4',
        type: 'u',
        minver: '2',
        webm: '0',
        default: '0'
      },
      b2: {
        name: 'CueDuration',
        level: '4',
        type: 'u',
        mandatory: '0',
        minver: '4',
        webm: '0'
      },
      f0: {
        name: 'CueRelativePosition',
        level: '4',
        type: 'u',
        mandatory: '0',
        minver: '4',
        webm: '0'
      },
      f1: {
        name: 'CueClusterPosition',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '1'
      },
      f7: {
        name: 'CueTrack',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '1',
        range: 'not 0'
      },
      b7: {
        name: 'CueTrackPositions',
        level: '3',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1'
      },
      b3: {
        name: 'CueTime',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1'
      },
      bb: {
        name: 'CuePoint',
        level: '2',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1'
      },
      '1c53bb6b': {
        name: 'Cues',
        level: '1',
        type: 'm',
        minver: '1'
      },
      '47e6': {
        name: 'ContentSigHashAlgo',
        level: '6',
        type: 'u',
        minver: '1',
        webm: '0',
        default: '0',
        br: [
          '',
          ''
        ]
      },
      '47e5': {
        name: 'ContentSigAlgo',
        level: '6',
        type: 'u',
        minver: '1',
        webm: '0',
        default: '0',
        br: ''
      },
      '47e4': {
        name: 'ContentSigKeyID',
        level: '6',
        type: 'b',
        minver: '1',
        webm: '0'
      },
      '47e3': {
        name: 'ContentSignature',
        level: '6',
        type: 'b',
        minver: '1',
        webm: '0'
      },
      '47e2': {
        name: 'ContentEncKeyID',
        level: '6',
        type: 'b',
        minver: '1',
        webm: '0'
      },
      '47e1': {
        name: 'ContentEncAlgo',
        level: '6',
        type: 'u',
        minver: '1',
        webm: '0',
        default: '0',
        br: ''
      },
      '6d80': {
        name: 'ContentEncodings',
        level: '3',
        type: 'm',
        minver: '1',
        webm: '0'
      },
      c4: {
        name: 'TrickMasterTrackSegmentUID',
        level: '3',
        type: 'b',
        divx: '1',
        bytesize: '16'
      },
      c7: {
        name: 'TrickMasterTrackUID',
        level: '3',
        type: 'u',
        divx: '1'
      },
      c6: {
        name: 'TrickTrackFlag',
        level: '3',
        type: 'u',
        divx: '1',
        default: '0'
      },
      c1: {
        name: 'TrickTrackSegmentUID',
        level: '3',
        type: 'b',
        divx: '1',
        bytesize: '16'
      },
      c0: {
        name: 'TrickTrackUID',
        level: '3',
        type: 'u',
        divx: '1'
      },
      ed: {
        name: 'TrackJoinUID',
        level: '5',
        type: 'u',
        mandatory: '1',
        multiple: '1',
        minver: '3',
        webm: '0',
        range: 'not 0'
      },
      e9: {
        name: 'TrackJoinBlocks',
        level: '4',
        type: 'm',
        minver: '3',
        webm: '0'
      },
      e6: {
        name: 'TrackPlaneType',
        level: '6',
        type: 'u',
        mandatory: '1',
        minver: '3',
        webm: '0'
      },
      e5: {
        name: 'TrackPlaneUID',
        level: '6',
        type: 'u',
        mandatory: '1',
        minver: '3',
        webm: '0',
        range: 'not 0'
      },
      e4: {
        name: 'TrackPlane',
        level: '5',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '3',
        webm: '0'
      },
      e3: {
        name: 'TrackCombinePlanes',
        level: '4',
        type: 'm',
        minver: '3',
        webm: '0'
      },
      e2: {
        name: 'TrackOperation',
        level: '3',
        type: 'm',
        minver: '3',
        webm: '0'
      },
      '7d7b': {
        name: 'ChannelPositions',
        cppname: 'AudioPosition',
        level: '4',
        type: 'b',
        webm: '0'
      },
      '9f': {
        name: 'Channels',
        cppname: 'AudioChannels',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '1',
        default: '1',
        range: 'not 0'
      },
      '78b5': {
        name: 'OutputSamplingFrequency',
        cppname: 'AudioOutputSamplingFreq',
        level: '4',
        type: 'f',
        minver: '1',
        default: 'Sampling Frequency',
        range: '> 0'
      },
      b5: {
        name: 'SamplingFrequency',
        cppname: 'AudioSamplingFreq',
        level: '4',
        type: 'f',
        mandatory: '1',
        minver: '1',
        default: '8000.0',
        range: '> 0'
      },
      e1: {
        name: 'Audio',
        cppname: 'TrackAudio',
        level: '3',
        type: 'm',
        minver: '1'
      },
      '2383e3': {
        name: 'FrameRate',
        cppname: 'VideoFrameRate',
        level: '4',
        type: 'f',
        range: '> 0',
        strong: 'Informational'
      },
      '2fb523': {
        name: 'GammaValue',
        cppname: 'VideoGamma',
        level: '4',
        type: 'f',
        webm: '0',
        range: '> 0'
      },
      '2eb524': {
        name: 'ColourSpace',
        cppname: 'VideoColourSpace',
        level: '4',
        type: 'b',
        minver: '1',
        webm: '0',
        bytesize: '4'
      },
      '54b3': {
        name: 'AspectRatioType',
        cppname: 'VideoAspectRatio',
        level: '4',
        type: 'u',
        minver: '1',
        default: '0'
      },
      '54b2': {
        name: 'DisplayUnit',
        cppname: 'VideoDisplayUnit',
        level: '4',
        type: 'u',
        minver: '1',
        default: '0'
      },
      '54ba': {
        name: 'DisplayHeight',
        cppname: 'VideoDisplayHeight',
        level: '4',
        type: 'u',
        minver: '1',
        default: 'PixelHeight',
        range: 'not 0'
      },
      '54b0': {
        name: 'DisplayWidth',
        cppname: 'VideoDisplayWidth',
        level: '4',
        type: 'u',
        minver: '1',
        default: 'PixelWidth',
        range: 'not 0'
      },
      '54dd': {
        name: 'PixelCropRight',
        cppname: 'VideoPixelCropRight',
        level: '4',
        type: 'u',
        minver: '1',
        default: '0'
      },
      '54cc': {
        name: 'PixelCropLeft',
        cppname: 'VideoPixelCropLeft',
        level: '4',
        type: 'u',
        minver: '1',
        default: '0'
      },
      '54bb': {
        name: 'PixelCropTop',
        cppname: 'VideoPixelCropTop',
        level: '4',
        type: 'u',
        minver: '1',
        default: '0'
      },
      '54aa': {
        name: 'PixelCropBottom',
        cppname: 'VideoPixelCropBottom',
        level: '4',
        type: 'u',
        minver: '1',
        default: '0'
      },
      ba: {
        name: 'PixelHeight',
        cppname: 'VideoPixelHeight',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '1',
        range: 'not 0'
      },
      b0: {
        name: 'PixelWidth',
        cppname: 'VideoPixelWidth',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '1',
        range: 'not 0'
      },
      '53b9': {
        name: 'OldStereoMode',
        level: '4',
        type: 'u',
        maxver: '0',
        webm: '0',
        divx: '0'
      },
      '53c0': {
        name: 'AlphaMode',
        cppname: 'VideoAlphaMode',
        level: '4',
        type: 'u',
        minver: '3',
        webm: '1',
        default: '0'
      },
      '53b8': {
        name: 'StereoMode',
        cppname: 'VideoStereoMode',
        level: '4',
        type: 'u',
        minver: '3',
        webm: '1',
        default: '0'
      },
      '9a': {
        name: 'FlagInterlaced',
        cppname: 'VideoFlagInterlaced',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '2',
        webm: '1',
        default: '0',
        range: '0-1'
      },
      e0: {
        name: 'Video',
        cppname: 'TrackVideo',
        level: '3',
        type: 'm',
        minver: '1'
      },
      '66a5': {
        name: 'TrackTranslateTrackID',
        level: '4',
        type: 'b',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      '66bf': {
        name: 'TrackTranslateCodec',
        level: '4',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      '66fc': {
        name: 'TrackTranslateEditionUID',
        level: '4',
        type: 'u',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      '56bb': {
        name: 'SeekPreRoll',
        level: '3',
        type: 'u',
        mandatory: '1',
        multiple: '0',
        default: '0',
        minver: '4',
        webm: '1'
      },
      '56aa': {
        name: 'CodecDelay',
        level: '3',
        type: 'u',
        multiple: '0',
        default: '0',
        minver: '4',
        webm: '1'
      },
      '6fab': {
        name: 'TrackOverlay',
        level: '3',
        type: 'u',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      aa: {
        name: 'CodecDecodeAll',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '2',
        webm: '0',
        default: '1',
        range: '0-1'
      },
      '26b240': {
        name: 'CodecDownloadURL',
        level: '3',
        type: 's',
        multiple: '1',
        webm: '0'
      },
      '3b4040': {
        name: 'CodecInfoURL',
        level: '3',
        type: 's',
        multiple: '1',
        webm: '0'
      },
      '3a9697': {
        name: 'CodecSettings',
        level: '3',
        type: '8',
        webm: '0'
      },
      '63a2': {
        name: 'CodecPrivate',
        level: '3',
        type: 'b',
        minver: '1'
      },
      '22b59c': {
        name: 'Language',
        cppname: 'TrackLanguage',
        level: '3',
        type: 's',
        minver: '1',
        default: 'eng'
      },
      '536e': {
        name: 'Name',
        cppname: 'TrackName',
        level: '3',
        type: '8',
        minver: '1'
      },
      '55ee': {
        name: 'MaxBlockAdditionID',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '0'
      },
      '537f': {
        name: 'TrackOffset',
        level: '3',
        type: 'i',
        webm: '0',
        default: '0'
      },
      '23314f': {
        name: 'TrackTimecodeScale',
        level: '3',
        type: 'f',
        mandatory: '1',
        minver: '1',
        maxver: '3',
        webm: '0',
        default: '1.0',
        range: '> 0'
      },
      '234e7a': {
        name: 'DefaultDecodedFieldDuration',
        cppname: 'TrackDefaultDecodedFieldDuration',
        level: '3',
        type: 'u',
        minver: '4',
        range: 'not 0'
      },
      '23e383': {
        name: 'DefaultDuration',
        cppname: 'TrackDefaultDuration',
        level: '3',
        type: 'u',
        minver: '1',
        range: 'not 0'
      },
      '6df8': {
        name: 'MaxCache',
        cppname: 'TrackMaxCache',
        level: '3',
        type: 'u',
        minver: '1',
        webm: '0'
      },
      '6de7': {
        name: 'MinCache',
        cppname: 'TrackMinCache',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '0'
      },
      '9c': {
        name: 'FlagLacing',
        cppname: 'TrackFlagLacing',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        default: '1',
        range: '0-1'
      },
      '55aa': {
        name: 'FlagForced',
        cppname: 'TrackFlagForced',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        default: '0',
        range: '0-1'
      },
      b9: {
        name: 'FlagEnabled',
        cppname: 'TrackFlagEnabled',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '2',
        webm: '1',
        default: '1',
        range: '0-1'
      },
      '73c5': {
        name: 'TrackUID',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        range: 'not 0'
      },
      d7: {
        name: 'TrackNumber',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        range: 'not 0'
      },
      ae: {
        name: 'TrackEntry',
        level: '2',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1'
      },
      '1654ae6b': {
        name: 'Tracks',
        level: '1',
        type: 'm',
        multiple: '1',
        minver: '1'
      },
      af: {
        name: 'EncryptedBlock',
        level: '2',
        type: 'b',
        multiple: '1',
        webm: '0'
      },
      ca: {
        name: 'ReferenceTimeCode',
        level: '4',
        type: 'u',
        multiple: '0',
        mandatory: '1',
        minver: '0',
        webm: '0',
        divx: '1'
      },
      c9: {
        name: 'ReferenceOffset',
        level: '4',
        type: 'u',
        multiple: '0',
        mandatory: '1',
        minver: '0',
        webm: '0',
        divx: '1'
      },
      c8: {
        name: 'ReferenceFrame',
        level: '3',
        type: 'm',
        multiple: '0',
        minver: '0',
        webm: '0',
        divx: '1'
      },
      cf: {
        name: 'SliceDuration',
        level: '5',
        type: 'u',
        default: '0'
      },
      ce: {
        name: 'Delay',
        cppname: 'SliceDelay',
        level: '5',
        type: 'u',
        default: '0'
      },
      cb: {
        name: 'BlockAdditionID',
        cppname: 'SliceBlockAddID',
        level: '5',
        type: 'u',
        default: '0'
      },
      cd: {
        name: 'FrameNumber',
        cppname: 'SliceFrameNumber',
        level: '5',
        type: 'u',
        default: '0'
      },
      cc: {
        name: 'LaceNumber',
        cppname: 'SliceLaceNumber',
        level: '5',
        type: 'u',
        minver: '1',
        default: '0',
        divx: '0'
      },
      e8: {
        name: 'TimeSlice',
        level: '4',
        type: 'm',
        multiple: '1',
        minver: '1',
        divx: '0'
      },
      '8e': {
        name: 'Slices',
        level: '3',
        type: 'm',
        minver: '1',
        divx: '0'
      },
      '75a2': {
        name: 'DiscardPadding',
        level: '3',
        type: 'i',
        minver: '4',
        webm: '1'
      },
      a4: {
        name: 'CodecState',
        level: '3',
        type: 'b',
        minver: '2',
        webm: '0'
      },
      fd: {
        name: 'ReferenceVirtual',
        level: '3',
        type: 'i',
        webm: '0'
      },
      fb: {
        name: 'ReferenceBlock',
        level: '3',
        type: 'i',
        multiple: '1',
        minver: '1'
      },
      fa: {
        name: 'ReferencePriority',
        cppname: 'FlagReferenced',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '0'
      },
      '9b': {
        name: 'BlockDuration',
        level: '3',
        type: 'u',
        minver: '1',
        default: 'TrackDuration'
      },
      a5: {
        name: 'BlockAdditional',
        level: '5',
        type: 'b',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      ee: {
        name: 'BlockAddID',
        level: '5',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0',
        default: '1',
        range: 'not 0'
      },
      a6: {
        name: 'BlockMore',
        level: '4',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      '75a1': {
        name: 'BlockAdditions',
        level: '3',
        type: 'm',
        minver: '1',
        webm: '0'
      },
      a2: {
        name: 'BlockVirtual',
        level: '3',
        type: 'b',
        webm: '0'
      },
      a1: {
        name: 'Block',
        level: '3',
        type: 'b',
        mandatory: '1',
        minver: '1'
      },
      a0: {
        name: 'BlockGroup',
        level: '2',
        type: 'm',
        multiple: '1',
        minver: '1'
      },
      a3: {
        name: 'SimpleBlock',
        level: '2',
        type: 'b',
        multiple: '1',
        minver: '2',
        webm: '1',
        divx: '1'
      },
      ab: {
        name: 'PrevSize',
        cppname: 'ClusterPrevSize',
        level: '2',
        type: 'u',
        minver: '1'
      },
      a7: {
        name: 'Position',
        cppname: 'ClusterPosition',
        level: '2',
        type: 'u',
        minver: '1',
        webm: '0'
      },
      '58d7': {
        name: 'SilentTrackNumber',
        cppname: 'ClusterSilentTrackNumber',
        level: '3',
        type: 'u',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      e7: {
        name: 'Timecode',
        cppname: 'ClusterTimecode',
        level: '2',
        type: 'u',
        mandatory: '1',
        minver: '1'
      },
      '1f43b675': {
        name: 'Cluster',
        level: '1',
        type: 'm',
        multiple: '1',
        minver: '1'
      },
      '4d80': {
        name: 'MuxingApp',
        level: '2',
        type: '8',
        mandatory: '1',
        minver: '1'
      },
      '7ba9': {
        name: 'Title',
        level: '2',
        type: '8',
        minver: '1',
        webm: '0'
      },
      '2ad7b2': {
        name: 'TimecodeScaleDenominator',
        level: '2',
        type: 'u',
        mandatory: '1',
        minver: '4',
        default: '1000000000'
      },
      '2ad7b1': {
        name: 'TimecodeScale',
        level: '2',
        type: 'u',
        mandatory: '1',
        minver: '1',
        default: '1000000'
      },
      '69a5': {
        name: 'ChapterTranslateID',
        level: '3',
        type: 'b',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      '69bf': {
        name: 'ChapterTranslateCodec',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1',
        webm: '0'
      },
      '69fc': {
        name: 'ChapterTranslateEditionUID',
        level: '3',
        type: 'u',
        multiple: '1',
        minver: '1',
        webm: '0'
      },
      '3e83bb': {
        name: 'NextFilename',
        level: '2',
        type: '8',
        minver: '1',
        webm: '0'
      },
      '3eb923': {
        name: 'NextUID',
        level: '2',
        type: 'b',
        minver: '1',
        webm: '0',
        bytesize: '16'
      },
      '3c83ab': {
        name: 'PrevFilename',
        level: '2',
        type: '8',
        minver: '1',
        webm: '0'
      },
      '3cb923': {
        name: 'PrevUID',
        level: '2',
        type: 'b',
        minver: '1',
        webm: '0',
        bytesize: '16'
      },
      '73a4': {
        name: 'SegmentUID',
        level: '2',
        type: 'b',
        minver: '1',
        webm: '0',
        range: 'not 0',
        bytesize: '16'
      },
      '1549a966': {
        name: 'Info',
        level: '1',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1'
      },
      '53ac': {
        name: 'SeekPosition',
        level: '3',
        type: 'u',
        mandatory: '1',
        minver: '1'
      },
      '53ab': {
        name: 'SeekID',
        level: '3',
        type: 'b',
        mandatory: '1',
        minver: '1'
      },
      '4dbb': {
        name: 'Seek',
        cppname: 'SeekPoint',
        level: '2',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1'
      },
      '114d9b74': {
        name: 'SeekHead',
        cppname: 'SeekHeader',
        level: '1',
        type: 'm',
        multiple: '1',
        minver: '1'
      },
      '7e7b': {
        name: 'SignatureElementList',
        level: '2',
        type: 'm',
        multiple: '1',
        webm: '0',
        i: 'Cluster|Block|BlockAdditional'
      },
      '7e5b': {
        name: 'SignatureElements',
        level: '1',
        type: 'm',
        webm: '0'
      },
      '7eb5': {
        name: 'Signature',
        level: '1',
        type: 'b',
        webm: '0'
      },
      '7ea5': {
        name: 'SignaturePublicKey',
        level: '1',
        type: 'b',
        webm: '0'
      },
      '7e9a': {
        name: 'SignatureHash',
        level: '1',
        type: 'u',
        webm: '0'
      },
      '7e8a': {
        name: 'SignatureAlgo',
        level: '1',
        type: 'u',
        webm: '0'
      },
      '1b538667': {
        name: 'SignatureSlot',
        level: '-1',
        type: 'm',
        multiple: '1',
        webm: '0'
      },
      bf: {
        name: 'CRC-32',
        level: '-1',
        type: 'b',
        minver: '1',
        webm: '0'
      },
      ec: {
        name: 'Void',
        level: '-1',
        type: 'b',
        minver: '1'
      },
      '42f3': {
        name: 'EBMLMaxSizeLength',
        level: '1',
        type: 'u',
        mandatory: '1',
        default: '8',
        minver: '1'
      },
      '42f2': {
        name: 'EBMLMaxIDLength',
        level: '1',
        type: 'u',
        mandatory: '1',
        default: '4',
        minver: '1'
      },
      '42f7': {
        name: 'EBMLReadVersion',
        level: '1',
        type: 'u',
        mandatory: '1',
        default: '1',
        minver: '1'
      },
      '1a45dfa3': {
        name: 'EBML',
        level: '0',
        type: 'm',
        mandatory: '1',
        multiple: '1',
        minver: '1'
      }
    }
    EbmlDecoder.prototype.tools = {
      /**
       * Read variable length integer per https://www.matroska.org/technical/specs/index.html#EBML_ex
       * @param buffer
       * @param {Number} start
       * @returns {Number}  value / length object
       */
      readVint: function (buffer, start) {
        start = start || 0
        for (var length = 1; length <= 8; length++) {
          if (buffer[start] >= Math.pow(2, 8 - length)) {
            break
          }
        }
        if (length > 8) {
          let maxl = length
          if (maxl > 20) maxl = 20
          const sampleContents = buffer.subarray(start, start + maxl)
          let msg = 'Corrupt webm: bad box length: ' + length + ' ' + sampleContents.toString('hex')
          if (length !== maxl) msg += '...'
          throw new Error(msg)
        }
        if (start + length > buffer.length) {
          return null
        }
        let value = buffer[start] & (1 << (8 - length)) - 1
        for (let i = 1; i < length; i++) {
          if (i === 7) {
            if (value >= Math.pow(2, 53 - 8) && buffer[start + 7] > 0) {
              return {
                length: length,
                value: -1
              }
            }
          }
          value *= Math.pow(2, 8)
          value += buffer[start + i]
        }
        return {
          length: length,
          value: value
        }
      },

      /**
       * Write a variable-length integer EBML / Matroska / webm style
       * @param value
       * @returns {Buffer} variable-length integer
       */
      writeVint: function (value) {
        if (value < 0 || value > Math.pow(2, 53)) {
          throw new Error('Corrupt webm: bad value:' + value)
        }
        for (var length = 1; length <= 8; length++) {
          if (value < Math.pow(2, 7 * length) - 1) {
            break
          }
        }
        const buffer = new Uint8Array(length)
        for (let i = 1; i <= length; i++) {
          const b = value & 0xFF
          buffer[length - i] = b
          value -= b
          value /= Math.pow(2, 8)
        }
        buffer[0] = buffer[0] | (1 << (8 - length))
        return buffer
      },

      /***
       * concatenate two arrays of bytes
       * @param {Uint8Array} a1  First array
       * @param {Uint8Array} a2  Second array
       * @returns  {Uint8Array} concatenated arrays
       */
      concatenate: function (a1, a2) {
        if (!a1 || a1.byteLength === 0) return a2
        if (!a2 || a2.byteLength === 0) return a1
        const result = new Uint8Array(a1.byteLength + a2.byteLength)
        result.set(a1, 0)
        result.set(a2, a1.byteLength)
        a1 = null
        a2 = null
        return result
      },

      /**
       * get a hex text string from Buff[start,end)
       * @param {Array} buff
       * @param {Number} start
       * @param {Number} end
       * @returns {string} the hex string
       */
      readHexString: function (buff, start, end) {
        let result = ''

        if (!start) start = 0
        if (!end) end = buff.byteLength

        for (let p = start; p < end; p++) {
          const q = Number(buff[p] & 0xff)
          result += ('00' + q.toString(16)).substr(-2)
        }
        return result
      },
      readUtf8: function (buff) {
        if (typeof window === 'undefined') {
          return Buffer.from(buff.buffer, buff.byteOffset, buff.byteLength).toString('utf8')
        }
        try {
          /* Redmond Middle School science projects don't do this. */
          if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder('utf8').decode(buff)
          }
          return null
        } catch (exception) {
          return null
        }
      },

      /**
       * get an unsigned number from a buffer
       * @param buff
       * @returns {number} result (in hex for lengths > 6)
       */
      readUnsigned: function (buff) {
        const b = new DataView(buff.buffer, buff.byteOffset, buff.byteLength)
        switch (buff.byteLength) {
          case 1:
            return b.getUint8(0)
          case 2:
            return b.getUint16(0)
          case 4:
            return b.getUint32(0)
        }
        if (buff.byteLength <= 6) {
          let val = 0
          for (let i = 0; i < buff.byteLength; i++) val = (val * 256) + buff[i]
          return val
        } else {
          return tools.readHexString(buff)
        }
      },

      /**
       * get a signed number from a buffer
       * @param buff
       * @returns {number} result (in hex for lengths > 6)
       */
      readSigned: function (buff) {
        const b = new DataView(buff.buffer, buff.byteOffset, buff.byteLength)
        switch (buff.byteLength) {
          case 1:
            return b.getInt8(0)
          case 2:
            return b.getInt16(0)
          case 4:
            return b.getInt32(0)
        }
        return NaN
      },

      /**
       * get a floating-point from a buffer
       * @param buff
       * @returns {number} result (in hex for lengths > 6)
       */
      readFloat: function (buff) {
        const b = new DataView(buff.buffer, buff.byteOffset, buff.byteLength)
        switch (buff.byteLength) {
          case 4:
            return b.getFloat32(0)
          case 8:
            return b.getFloat64(0)
          default:
            return NaN
        }
      },

      readDataFromTag: function (tagObj, data) {
        tagObj.data = data
        switch (tagObj.type) {
          case 'u':
            tagObj.value = tools.readUnsigned(data)
            break
          case 'f':
            tagObj.value = tools.readFloat(data)
            break
          case 'i':
            tagObj.value = tools.readSigned(data)
            break
          case 's':
            tagObj.value = String.fromCharCode.apply(null, data)
            break
          case '8':
            tagObj.value = tools.readUtf8(data)
            break
          default:
            break
        }

        if (tagObj.name === 'SimpleBlock' || tagObj.name === 'Block') {
          let p = 0
          const track = tools.readVint(data, p)
          p += track.length
          tagObj.track = track.value
          tagObj.value = tools.readSigned(data.subarray(p, p + 2))
          p += 2
          if (tagObj.name === 'SimpleBlock') {
            tagObj.keyframe = Boolean(data[track.length + 2] & 0x80)
            tagObj.discardable = Boolean(data[track.length + 2] & 0x01)
          }
          p++
          tagObj.payload = data.subarray(p)
        }
        return tagObj
      }
    }

    const tools = EbmlDecoder.prototype.tools
    self._schema = EbmlDecoder.prototype.schema
  }

  const profileNames = {
    66: 'BASELINE',
    77: 'MAIN',
    88: 'EXTENDED',
    100: 'FREXT_HP',
    110: 'FREXT_Hi10P',
    122: 'FREXT_Hi422',
    244: 'FREXT_Hi444',
    44: 'FREXT_CAVLC444'
  }

  /* eslint-disable camelcase */
  class SPS {
    constructor (SPS) {
      const bitstream = new Bitstream(SPS)

      const forbidden_zero_bit = bitstream.u_1()
      if (forbidden_zero_bit) throw new Error('NALU error: invalid NALU header')
      this.nal_ref_id = bitstream.u_2()
      this.nal_unit_type = bitstream.u(5)
      if (this.nal_unit_type !== 7) throw new Error('SPS error: not SPS')

      this.profile_idc = bitstream.u_8()
      if (profileNames[this.profile_idc]) {
        this.profileName = profileNames[this.profile_idc]
      } else {
        throw new Error('SPS error: invalid profile_idc')
      }

      this.constraint_set0_flag = bitstream.u_1()
      this.constraint_set1_flag = bitstream.u_1()
      this.constraint_set2_flag = bitstream.u_1()
      this.constraint_set3_flag = bitstream.u_1()
      this.constraint_set4_flag = bitstream.u_1()
      this.constraint_set5_flag = bitstream.u_1()
      const reserved_zero_2bits = bitstream.u_2()
      if (reserved_zero_2bits !== 0) {
        throw new Error('SPS error: reserved_zero_2bits must be zero')
      }

      this.level_idc = bitstream.u_8()

      this.seq_parameter_set_id = bitstream.ue_v()
      if (this.seq_parameter_set_id > 31) {
        throw new Error('SPS error: seq_parameter_set_id must be 31 or less')
      }

      this.has_no_chroma_format_idc =
        (this.profile_idc === 66 || this.profile_idc === 77 || this.profile_idc === 88)

      if (!this.has_no_chroma_format_idc) {
        this.chroma_format_idc = bitstream.ue_v()
        if (this.bit_depth_luma_minus8 > 3) {
          throw new Error('SPS error: chroma_format_idc must be 3 or less')
        }
        if (this.chroma_format_idc === 3) { /* 3 = YUV444 */
          this.separate_colour_plane_flag = bitstream.u_1()
          this.chromaArrayType = this.separate_colour_plane_flag ? 0 : this.chroma_format_idc
        }
        this.bit_depth_luma_minus8 = bitstream.ue_v()
        if (this.bit_depth_luma_minus8 > 6) {
          throw new Error('SPS error: bit_depth_luma_minus8 must be 6 or less')
        }
        this.bitDepthLuma = this.bit_depth_luma_minus8 + 8
        this.bit_depth_chroma_minus8 = bitstream.ue_v()
        if (this.bit_depth_chroma_minus8 > 6) {
          throw new Error('SPS error: bit_depth_chroma_minus8 must be 6 or less')
        }
        this.lossless_qpprime_flag = bitstream.u_1()
        this.bitDepthChroma = this.bit_depth_chroma_minus8 + 8
        this.seq_scaling_matrix_present_flag = bitstream.u_1()
        if (this.seq_scaling_matrix_present_flag) {
          const n_ScalingList = (this.chroma_format_idc !== 3) ? 8 : 12
          this.seq_scaling_list_present_flag = []
          this.seq_scaling_list = []
          for (let i = 0; i < n_ScalingList; i++) {
            const seqScalingListPresentFlag = bitstream.u_1()
            this.seq_scaling_list_present_flag.push(seqScalingListPresentFlag)
            if (seqScalingListPresentFlag) {
              const sizeOfScalingList = i < 6 ? 16 : 64
              let nextScale = 8
              let lastScale = 8
              const delta_scale = []
              for (let j = 0; j < sizeOfScalingList; j++) {
                if (nextScale !== 0) {
                  const deltaScale = bitstream.se_v()
                  delta_scale.push(deltaScale)
                  nextScale = (lastScale + delta_scale + 256) % 256
                }
                lastScale = (nextScale === 0) ? lastScale : nextScale
                this.seq_scaling_list.push(delta_scale)
              }
            }
          }
        }
      }

      this.log2_max_frame_num_minus4 = bitstream.ue_v()
      if (this.log2_max_frame_num_minus4 > 12) {
        throw new Error('SPS error: log2_max_frame_num_minus4 must be 12 or less')
      }
      this.maxFrameNum = 1 << (this.log2_max_frame_num_minus4 + 4)

      this.pic_order_cnt_type = bitstream.ue_v()
      if (this.pic_order_cnt_type > 2) {
        throw new Error('SPS error: pic_order_cnt_type must be 2 or less')
      }

      let expectedDeltaPerPicOrderCntCycle = 0
      switch (this.pic_order_cnt_type) {
        case 0:
          this.log2_max_pic_order_cnt_lsb_minus4 = bitstream.ue_v()
          if (this.log2_max_pic_order_cnt_lsb_minus4 > 12) {
            throw new Error('SPS error: log2_max_pic_order_cnt_lsb_minus4 must be 12 or less')
          }
          this.maxPicOrderCntLsb = 1 << (this.log2_max_pic_order_cnt_lsb_minus4 + 4)
          break
        case 1:
          this.delta_pic_order_always_zero_flag = bitstream.u_1()
          this.offset_for_non_ref_pic = bitstream.se_v()
          this.offset_for_top_to_bottom_field = bitstream.se_v()
          this.num_ref_frames_in_pic_order_cnt_cycle = bitstream.ue_v()
          this.offset_for_ref_frame = []
          for (let i = 0; i < this.num_ref_frames_in_pic_order_cnt_cycle; i++) {
            const offsetForRefFrame = bitstream.se_v()
            this.offset_for_ref_frame.push(offsetForRefFrame)
            // eslint-disable-next-line no-unused-vars
            expectedDeltaPerPicOrderCntCycle += offsetForRefFrame
          }
          break
        case 2:
          /* there is nothing for case 2 */
          break
      }

      this.max_num_ref_frames = bitstream.ue_v()
      this.gaps_in_frame_num_value_allowed_flag = bitstream.u_1()
      this.pic_width_in_mbs_minus_1 = bitstream.ue_v()
      this.picWidth = (this.pic_width_in_mbs_minus_1 + 1) << 4
      this.pic_height_in_map_units_minus_1 = bitstream.ue_v()
      this.frame_mbs_only_flag = bitstream.u_1()
      this.interlaced = !this.frame_mbs_only_flag
      if (this.frame_mbs_only_flag === 0) { /* 1 if frames rather than fields (no interlacing) */
        this.mb_adaptive_frame_field_flag = bitstream.u_1()
      }
      this.picHeight = ((2 - this.frame_mbs_only_flag) * (this.pic_height_in_map_units_minus_1 + 1)) << 4

      this.direct_8x8_inference_flag = bitstream.u_1()
      this.frame_cropping_flag = bitstream.u_1()
      if (this.frame_cropping_flag) {
        this.frame_cropping_rect_left_offset = bitstream.ue_v()
        this.frame_cropping_rect_right_offset = bitstream.ue_v()
        this.frame_cropping_rect_top_offset = bitstream.ue_v()
        this.frame_cropping_rect_bottom_offset = bitstream.ue_v()
        this.cropRect = {
          x: this.frame_cropping_rect_left_offset,
          y: this.frame_cropping_rect_top_offset,
          width: this.picWidth - (this.frame_cropping_rect_left_offset + this.frame_cropping_rect_right_offset),
          height: this.picHeight - (this.frame_cropping_rect_top_offset + this.frame_cropping_rect_bottom_offset)
        }
      } else {
        this.cropRect = {
          x: 0,
          y: 0,
          width: this.picWidth,
          height: this.picHeight
        }
      }
      this.vui_parameters_present_flag = bitstream.u_1()
      this.success = true
    }

    get profile_compatibility () {
      let v = this.constraint_set0_flag << 7
      v |= this.constraint_set1_flag << 6
      v |= this.constraint_set2_flag << 5
      v |= this.constraint_set3_flag << 4
      v |= this.constraint_set4_flag << 3
      v |= this.constraint_set5_flag << 1
      return v
    }

    /**
     * getter for the MIME type encoded in this avcC
     * @returns {string}
     */
    get MIME () {
      const f = []
      f.push('avc1.')
      f.push(AvcC.byte2hex(this.profile_idc).toUpperCase())
      f.push(AvcC.byte2hex(this.profile_compatibility).toUpperCase())
      f.push(AvcC.byte2hex(this.level_idc).toUpperCase())
      return f.join('')
    }
  }

  class PPS {
    constructor (NALU) {
      const bitstream = new Bitstream(NALU)

      const forbidden_zero_bit = bitstream.u_1()
      if (forbidden_zero_bit) throw new Error('NALU error: invalid NALU header')
      this.nal_ref_id = bitstream.u_2()
      this.nal_unit_type = bitstream.u(5)
      if (this.nal_unit_type !== 8) throw new Error('PPS error: not PPS')
      this.pic_parameter_set_id = bitstream.ue_v()
      this.seq_parameter_set_id = bitstream.ue_v()
      this.entropy_coding_mode_flag = bitstream.u_1()
      this.entropyCodingMode = this.entropy_coding_mode_flag ? 'CABAC' : 'CAVLC'
      this.bottom_field_pic_order_in_frame_present_flag = bitstream.u_1()
      this.num_slice_groups_minus1 = bitstream.ue_v()
      this.numSliceGroups = this.num_slice_groups_minus1 + 1
      if (this.num_slice_groups_minus1 > 0) {
        this.slice_group_map_type = bitstream.ue_v()
        switch (this.slice_group_map_type) {
          case 0:
            this.run_length_minus1 = []
            for (let i = 0; i <= this.num_slice_groups_minus1; i++) {
              this.run_length_minus1.push(bitstream.ue_v())
            }
            break
          case 1: /* there is no case 1 */
            break
          case 2:
            this.top_left = []
            this.bottom_right = []
            for (let i = 0; i <= this.num_slice_groups_minus1; i++) {
              const topLeft = bitstream.ue_v()
              const bottomRight = bitstream.ue_v()
              if (topLeft > bottomRight) {
                throw new Error('PPS error: bottom_right less than top_left when slice_group_map is 2')
              }
              this.top_left.push(topLeft)
              this.bottom_right.push(bottomRight)
            }
            break
          case 3:
          case 4:
          case 5:
            if (this.num_slice_groups_minus1 !== 1) {
              throw new Error('PPS error: num_slice_groups_minus1 must be 1 when slice_group_map is 3,4,5')
            }
            this.slice_group_change_direction_flag = bitstream.u_1()
            this.slice_group_change_rate_minus1 = bitstream.ue_v()
            break
          case 6:
            if (this.num_slice_groups_minus1 + 1 > 4) {
              this.numberBitsPerSliceGroupId = 3
            } else if (this.num_slice_groups_minus1 + 1 > 2) {
              this.numberBitsPerSliceGroupId = 2
            } else {
              this.numberBitsPerSliceGroupId = 1
            }
            this.pic_size_in_map_units_minus1 = bitstream.ue_v()
            this.slice_group_id = []
            for (let i = 0; i <= this.pic_size_in_map_units_minus1; i++) {
              const sliceGroupId = bitstream.u(this.numberBitsPerSliceGroupId)
              if (sliceGroupId > this.num_slice_groups_minus1) {
                throw new Error('PPS error: slice_group_id must not be greater than num_slice_groups_minus1 when slice_group_map is 6')
              }
              this.slice_group_id.push(sliceGroupId)
            }
            break
        }
      }
      this.num_ref_idx_l0_active_minus1 = bitstream.ue_v()
      if (this.num_ref_idx_l0_active_minus1 > 31) {
        throw new Error('PPS error: num_ref_idx_l0_active_minus1 may not be greater than 31')
      }
      this.num_ref_idx_l1_active_minus1 = bitstream.ue_v()
      if (this.num_ref_idx_l1_active_minus1 > 31) {
        throw new Error('PPS error: num_ref_idx_l1_active_minus1 may not be greater than 31')
      }
      this.weighted_pred_flag = bitstream.u_1()
      this.weighted_bipred_idc = bitstream.u_2()
      this.pic_init_qp_minus26 = bitstream.se_v()
      if (this.pic_init_qp_minus26 > 25) {
        throw new Error('PPS error: pic_init_qp_minus26 may not be greater than 25')
      }
      this.pic_init_qs_minus26 = bitstream.se_v()
      if (this.pic_init_qs_minus26 > 25) {
        throw new Error('PPS error: pic_init_qs_minus26 may not be greater than 25')
      }
      this.deblocking_filter_control_present_flag = bitstream.u_1()
      this.constrained_intra_pred_flag = bitstream.u_1()
      this.redundant_pic_cnt_present_flag = bitstream.u_1()

      this.success = true
    }
  }

  /**
   * Tools for handling H.264 bitstream issues.
   */
  class Bitstream {
    /**
     * Construct a bitstream
     * @param stream  Buffer containing the stream
     * @param max  Length, in BITS, of stream  (optional)
     */
    constructor (stream, max) {
      this.buffer = new Uint8Array(stream, 0, stream.byteLength)
      this.ptr = 0
      this.max = max || (stream.byteLength << 3)
    }

    /**
     * utility  / debugging function to examine next 16 bits of stream
     * @returns {string} Remaining unconsumed bits in the stream
     * (Careful: getters cannot have side-effects like advancing a pointer)
     */
    get peek16 () {
      let n = 16
      let p = this.ptr
      if (n + p > this.remaining) n = this.remaining
      const bitstrings = []
      const hexstrings = []
      /* nibble accumulators */
      const bits = []
      let nibble = 0
      for (let i = 0; i < n; i++) {
        const q = (p >> 3)
        const o = 0x07 - (p & 0x07)
        const bit = (this.buffer[q] >> o) & 0x01
        nibble = (nibble << 1) | bit
        bits.push(bit)
        p++
        if (i === n - 1 || (i % 4) === 3) {
          hexstrings.push(nibble.toString(16))
          let bitstring = ''
          bits.forEach(bit => { bitstring += (bit === 0) ? '0' : '1' })
          bitstrings.push(bitstring)
          bits.length = 0
          nibble = 0
        }
      }
      return bitstrings.join(' ') + ' ' + hexstrings.join('')
    }

    /**
     * number of bits remaining in the present stream
     * @returns {number}
     */
    get remaining () {
      return this.max - this.ptr
    }

    /**
     * number of bits already consumed in the present stream
     * @returns {number}
     */
    get consumed () {
      return this.ptr
    }

    /**
     * get one bit
     * @returns {number}
     */
    u_1 () {
      if (this.ptr + 1 >= this.max) throw new Error('NALUStream error: bitstream exhausted')
      const p = (this.ptr >> 3)
      const o = 0x07 - (this.ptr & 0x07)
      const val = (this.buffer[p] >> o) & 0x01
      this.ptr++
      return val
    }

    /**
     * get two bits
     * @returns {number}
     */
    u_2 () {
      return (this.u_1() << 1) | (this.u_1())
    }

    /**
     * get three bits
     * @returns {number}
     */
    u_3 () {
      return (this.u_1() << 2) | (this.u_1() << 1) | (this.u_1())
    }

    /**
     * get n bits
     * @param n
     * @returns {number}
     */
    u (n) {
      if (this.ptr + n >= this.max) throw new Error('NALUStream error: bitstream exhausted')
      let val = 0
      for (let i = 0; i < n; i++) {
        val = (val << 1) | this.u_1()
      }
      return val
    }

    /**
     * get one byte (as an unsigned number)
     * @returns {number}
     */
    u_8 () {
      if (this.ptr + 8 >= this.max) throw new Error('NALUStream error: bitstream exhausted')
      if ((this.ptr & 0x07) === 0) {
        const val = this.buffer[(this.ptr >> 3)]
        this.ptr += 8
        return val
      } else return this.u(8)
    }

    /**
     * get an unsigned H.264-style variable-bit number
     * in exponential Golomb format
     * @returns {number}
     */
    ue_v () {
      let zeros = 0
      while (!this.u_1()) zeros++
      let val = 1 << zeros
      for (let i = zeros - 1; i >= 0; i--) {
        val |= (this.u_1() << i)
      }
      return val - 1
    }

    /**
     * get a signed h.264-style variable bit number
     * in exponential Golomb format
     * @returns {number}
     */
    se_v () {
      const codeword = this.ue_v()
      if (codeword & 0x01) {
        return 1 + (codeword >> 1)
      }
      return -(codeword >> 1)
    }
  }

  /**
   * Handle the parsing and creation of "avcC" atoms.
   */
  class AvcC {
    /**
     * The options here:
     *    options.bitstream is a bunch of NALUs, the video payload from a webm key frame.
     *    options.NALUStream, a bitstream in a NALUStream object, read on.
     *    options.sps and options.pps   SPS and PPS NALUs from the H.264 bitstream.
     *    options.avcC. an existing avcC object.
     *    options.strict  if true, this throws more errors on unexpected data.
     * @param options
     */
    constructor (options) {
      /* instance props */
      this.strict = true
      this.sps = []
      this.pps = []
      this.configurationVersion = 1
      this.profileIndication = 0xff
      this.profileCompatibility = 0xff
      this.avcLevelIndication = 0xff
      this.boxSizeMinusOne = 3
      this.cacheAvcC = null
      this.extradata = null

      if (typeof options.strict === 'boolean') this.strict = options.strict
      if (typeof options.strictLength === 'boolean') this.strictLength = options.strictLength
      /* construct avcC from NALU stream */
      let stream
      if (options.bitstream || options.naluStream) {
        stream = options.naluStream ? options.naluStream : new NALUStream(options.bitstream, options)
        this.boxSizeMinusOne = stream.boxSizeMinusOne
        for (const nalu of stream) {
          switch (nalu[0] & 0x1f) {
            case 7:
              this.unpackSps(nalu)
              this.sps.push(nalu)
              break
            case 8:
              this.unpackPps(nalu)
              this.pps.push(nalu)
              break
          }
          if (this.pps.length > 0 && this.sps.length > 0) return
        }
        if (this.strict) throw new Error('avcC error: bitstream must contain both SPS and PPS')
      } else if (options.sps && options.pps) {
        /* construct avcC from sps and pps */
        this.unpackSps(options.sps)
        this.unpackPps(options.pps)
        this.sps.push(options.sps)
        this.pps.push(options.pps)
      } else if (options.avcC) {
        /* construct it from avcC stream */
        this.cacheAvcC = options.avcC
        this.parseAvcC(options.avcC)
      }
      if (profileNames[this.profileIndication]) {
        this.profileName = profileNames[this.profileIndication]
      } else {
        throw new Error('avcC error: invalid profileIndication')
      }
    }

    /**
     * setter for the avcC object
     * @param {Uint8Array} avcC
     */
    set avcC (avcC) {
      this.cacheAvcC = avcC
      this.parseAvcC(this.cacheAvcC)
    }

    /**
     * getter for the avcC object
     * @returns {Uint8Array}
     */
    get avcC () {
      this.cacheAvcC = this.packAvcC()
      return this.cacheAvcC
    }

    get hex () {
      return NALUStream.array2hex(this.cacheAvcC)
    }

    /**
     * getter for the MIME type encoded in this avcC
     * @returns {string}
     */
    get MIME () {
      const f = []
      f.push('avc1.')
      f.push(AvcC.byte2hex(this.profileIndication).toUpperCase())
      f.push(AvcC.byte2hex(this.profileCompatibility).toUpperCase())
      f.push(AvcC.byte2hex(this.avcLevelIndication).toUpperCase())
      return f.join('')
    }

    parseAvcC (inbuff) {
      const buf = new Uint8Array(inbuff, 0, inbuff.byteLength)
      const buflen = buf.byteLength
      if (buflen < 10) throw new Error('avcC error: object too short')
      let ptr = 0
      this.configurationVersion = buf[ptr++]
      if (this.strict && this.configurationVersion !== 1) {
        throw new Error(`avcC error: configuration version must be 1: ${this.configurationVersion}`)
      }
      this.profileIndication = buf[ptr++]
      this.profileCompatibility = buf[ptr++]
      this.avcLevelIndication = buf[ptr++]
      this.boxSizeMinusOne = buf[ptr++] & 3
      let nalen = buf[ptr++] & 0x1f
      ptr = this.captureNALUs(buf, ptr, nalen, this.sps)
      nalen = buf[ptr++]
      ptr = this.captureNALUs(buf, ptr, nalen, this.pps)
      if (ptr < buflen) this.extradata = buf.subarray(ptr, buflen)
      return inbuff
    }

    captureNALUs (buf, ptr, count, nalus) {
      nalus.length = 0
      if (this.strict && count <= 0) {
        throw new Error('avcC error: at least one NALU is required')
      }
      try {
        for (let i = 0; i < count; i++) {
          const len = AvcC.readUInt16BE(buf, ptr)
          ptr += 2
          const nalu = buf.slice(ptr, ptr + len)
          nalus.push(nalu)
          ptr += len
        }
      } catch (ex) {
        throw new Error(ex)
      }
      return ptr
    }

    unpackSps (spsData) {
      const sps = new SPS(spsData)
      this.profileIndication = sps.profile_idc
      this.profileCompatibility = sps.profile_compatibility
      this.avcLevelIndication = sps.level_idc
      this.cropRect = sps.cropRect
      return sps
    }

    unpackPps (ppsData) {
      const pps = new PPS(ppsData)
      this.interlaced = pps.interlaced
      this.cropRect = pps.croprect
    }

    /**
     * pack the avcC atom bitstream from the information in the class
     * @returns {Uint8Array}
     */
    packAvcC () {
      let length = 6
      for (let spsi = 0; spsi < this.sps.length; spsi++) length += 2 + this.sps[spsi].byteLength
      length += 1
      for (let ppsi = 0; ppsi < this.pps.length; ppsi++) length += 2 + this.pps[ppsi].byteLength
      if (this.extradata) length += this.extradata.byteLength
      const buf = new Uint8Array(length)
      let p = 0
      buf[p++] = this.configurationVersion
      buf[p++] = this.profileIndication
      buf[p++] = this.profileCompatibility
      buf[p++] = this.avcLevelIndication
      if (this.strict && (this.boxSizeMinusOne < 0 || this.boxSizeMinusOne > 3)) {
        throw new Error('avcC error: bad boxSizeMinusOne value: ' + this.boxSizeMinusOne)
      }
      buf[p++] = (0xfc | (0x03 & this.boxSizeMinusOne))
      p = AvcC.appendNALUs(buf, p, this.sps, 0x1f)
      p = AvcC.appendNALUs(buf, p, this.pps, 0xff)
      if (p < length) buf.set(this.extradata, p)
      return buf
    }

    /**
     * put NALU data (sps or pps) into output buffer
     * @param {Uint8Array} buf buffer
     * @param p {number} pointer to buf
     * @param nalus {array}  sps[] or pps[]
     * @param mask {number} mask for setting bits in nalu-count field
     * @returns {number} updated pointer.
     */
    static appendNALUs (buf, p, nalus, mask) {
      const setBits = ~mask
      if (this.strict && (nalus.length <= 0 || nalus.length > mask)) {
        throw new Error('avcC error: too many or not enough NALUs: ' + nalus.length)
      }
      buf[p++] = (setBits | (nalus.length & mask))
      for (let nalui = 0; nalui < nalus.length; nalui++) {
        const nalu = nalus[nalui]
        const len = nalu.byteLength
        if (this.strict && (len <= 0 || len > 0xffff)) {
          throw new Error('avcC error: NALU has wrong length: ' + len)
        }
        buf[p++] = 0xff & (len >> 8)
        buf[p++] = 0xff & len
        buf.set(nalu, p)
        p += len
      }
      return p
    }

    static readUInt16BE (buff, ptr) {
      return ((buff[ptr] << 8) & 0xff00) | ((buff[ptr + 1]) & 0x00ff) // jshint ignore:line
    }

    static readUInt32BE (buff, ptr) {
      let result = 0 | 0
      for (let i = ptr; i < ptr + 4; i++) {
        result = ((result << 8) | buff[i])
      }
      return result
    }

    static readUInt24BE (buff, ptr) {
      let result = 0 | 0
      for (let i = ptr; i < ptr + 3; i++) {
        result = ((result << 8) | buff[i])
      }
      return result
    }

    static byte2hex (val) {
      return ('00' + val.toString(16)).slice(-2)
    }
  }

  // noinspection JSBitwiseOperatorUsage
  /**
   * process buffers full of NALU streams
   */
  class NALUStream {
    /**
     * Construct a NALUStream from a buffer, figuring out what kind of stream it
     * is when the options are omitted.
     * @param {Uint8Array} buf buffer with a sequence of one or more NALUs
     * @param options strict, boxSize, boxSizeMinusOne, type='packet' or 'annexB',
     */
    constructor (buf, options) {
      this.validTypes = new Set(['packet', 'annexB', 'unknown'])
      this.strict = false
      this.type = null
      this.buf = null
      this.boxSize = null
      this.cursor = 0
      this.nextPacket = undefined

      if (options) {
        if (typeof options.strict === 'boolean') this.strict = Boolean(options.strict)
        if (options.boxSizeMinusOne) this.boxSize = options.boxSizeMinusOne + 1
        if (options.boxSize) this.boxSize = options.boxSize
        if (options.type) this.type = options.type
        if (this.type && !this.validTypes.has(this.type)) {
          throw new Error('NALUStream error: type must be packet or annexB')
        }
      }

      if (this.strict & this.boxSize && (this.boxSize < 2 || this.boxSize > 6)) {
        throw new Error('NALUStream error: invalid boxSize')
      }

      /* don't copy this.buf from input, just project it */
      this.buf = new Uint8Array(buf, 0, buf.length)

      if (!this.type || !this.boxSize) {
        const { type, boxSize } = this.getType(4)
        this.type = type
        this.boxSize = boxSize
      }
      this.nextPacket = this.type === 'packet'
        ? this.nextLengthCountedPacket
        : this.nextAnnexBPacket
    }

    get boxSizeMinusOne () {
      return this.boxSize - 1
    }

    /**
     * getter for number of NALUs in the stream
     * @returns {number}
     */
    get packetCount () {
      return this.iterate()
    }

    /**
     * Iterator allowing
     *      for (const nalu of stream) { }
     * Yields, space-efficiently, the elements of the stream
     * NOTE WELL: this yields subarrays of the NALUs in the stream, not copies.
     * so changing the NALU contents also changes the stream. Beware.
     * @returns {{next: next}}
     */
    [Symbol.iterator] () {
      let delim = { n: 0, s: 0, e: 0 }
      return {
        next: () => {
          if (this.type === 'unknown' ||
            this.boxSize < 1 ||
            delim.n < 0) {
            return { value: undefined, done: true }
          }
          delim = this.nextPacket(this.buf, delim.n, this.boxSize)
          while (true) {
            if (delim.e > delim.s) {
              const pkt = this.buf.subarray(delim.s, delim.e)
              return { value: pkt, done: false }
            }
            if (delim.n < 0) break
            delim = this.nextPacket(this.buf, delim.n, this.boxSize)
          }
          return { value: undefined, done: true }
        }
      }
    }

    /**
     * Returns an array of NALUs
     * NOTE WELL: this yields subarrays of the NALUs in the stream, not copies.
     * so changing the NALU contents also changes the stream. Beware.
     * @returns {[]}
     */
    get packets () {
      const pkts = []
      this.iterate((buf, first, last) => {
        const pkt = buf.subarray(first, last)
        pkts.push(pkt)
      })
      return pkts
    }

    /**
     * Convert an annexB stream to a packet stream in place, overwriting the buffer
     * @returns {NALUStream}
     */
    convertToPacket () {
      if (this.type === 'packet') return this
      /* change 00 00 00 01 delimiters to packet lengths */
      if (this.type === 'annexB' && this.boxSize === 4) {
        this.iterate((buff, first, last) => {
          let p = first - 4
          if (p < 0) throw new Error('NALUStream error: Unexpected packet format')
          const len = last - first
          buff[p++] = 0xff & (len >> 24)
          buff[p++] = 0xff & (len >> 16)
          buff[p++] = 0xff & (len >> 8)
          buff[p++] = 0xff & len
        })
      } else if (this.type === 'annexB' && this.boxSize === 3) {
        /* change 00 00 01 delimiters to packet lengths */
        this.iterate((buff, first, last) => {
          let p = first - 3
          if (p < 0) throw new Error('Unexpected packet format')
          const len = last - first
          if (this.strict && (0xff & (len >> 24) !== 0)) {
            throw new Error('NALUStream error: Packet too long to store length when boxLenMinusOne is 2')
          }
          buff[p++] = 0xff & (len >> 16)
          buff[p++] = 0xff & (len >> 8)
          buff[p++] = 0xff & len
        })
      }
      this.type = 'packet'
      this.nextPacket = this.nextLengthCountedPacket

      return this
    }

    iterate (callback) {
      if (this.type === 'unknown') return 0
      if (this.boxSize < 1) return 0
      let packetCount = 0
      let delim = this.nextPacket(this.buf, 0, this.boxSize)
      while (true) {
        if (delim.e > delim.s) {
          packetCount++
          if (typeof callback === 'function') callback(this.buf, delim.s, delim.e)
        }
        if (delim.n < 0) break
        delim = this.nextPacket(this.buf, delim.n, this.boxSize)
      }
      return packetCount
    }

    /**
     * iterator helper for delimited streams either 00 00 01  or 00 00 00 01
     * @param buf
     * @param p
     * @returns sequence of NALUs
     */
    nextAnnexBPacket (buf, p) {
      const buflen = buf.byteLength
      const start = p
      if (p === buflen) return { n: -1, s: start, e: p }
      while (p < buflen) {
        if (p + 2 > buflen) return { n: -1, s: start, e: buflen }
        if (buf[p] === 0 && buf[p + 1] === 0) {
          const d = buf[p + 2]
          if (d === 1) {
            /* 00 00 01 found */
            return { n: p + 3, s: start, e: p }
          } else if (d === 0) {
            if (p + 3 > buflen) return { n: -1, s: start, e: buflen }
            const e = buf[p + 3]
            if (e === 1) {
              /* 00 00 00 01 found */
              return { n: p + 4, s: start, e: p }
            }
          }
        }
        p++
      }
      return { n: -1, s: start, e: p }
    }

    /**
     * iterator helper for length-counted data
     * @param buf
     * @param p
     * @param boxSize
     * @returns {{s: *, e: *, n: *}|{s: number, e: number, message: string, n: number}}
     */
    nextLengthCountedPacket (buf, p, boxSize) {
      const buflen = buf.byteLength
      if (p < buflen) {
        const plength = NALUStream.readUIntNBE(buf, p, boxSize)
        if (plength < 2 || plength > buflen + boxSize) {
          return { n: -2, s: 0, e: 0, message: 'bad length' }
        }
        return { n: p + boxSize + plength, s: p + boxSize, e: p + boxSize + plength }
      }
      return { n: -1, s: 0, e: 0, message: 'end of buffer' }
    }

    /**
     * figure out type of data stream
     * @returns {{boxSize: number, type: string}}
     */
    getType (scanLimit) {
      if (this.type && this.boxSize) return { type: this.type, boxSize: this.boxSize }
      /* start with a delimiter? */
      if (!this.type || this.type === 'annexB') {
        if (this.buf[0] === 0 && this.buf[1] === 0 && this.buf[2] === 1) {
          return { type: 'annexB', boxSize: 3 }
        } else if (this.buf[0] === 0 && this.buf[1] === 0 && this.buf[2] === 0 && this.buf[3] === 1) {
          return { type: 'annexB', boxSize: 4 }
        }
      }
      /* possibly packet stream with lengths */
      /* try various boxSize values */
      for (let boxSize = 4; boxSize >= 1; boxSize--) {
        let packetCount = 0
        if (this.buf.length <= boxSize) {
          packetCount = -1
          break
        }
        let delim = this.nextLengthCountedPacket(this.buf, 0, boxSize)
        while (true) {
          if (delim.n < -1) {
            packetCount = -1
            break
          }
          if (delim.e - delim.s) {
            packetCount++
            if (scanLimit && packetCount >= scanLimit) break
          }
          if (delim.n < 0) break
          delim = this.nextLengthCountedPacket(this.buf, delim.n, boxSize)
        }
        if (packetCount > 0) {
          return { type: 'packet', boxSize: boxSize }
        }
      }
      if (this.strict) throw new Error('NALUStream error: cannot determine stream type or box size')
      return { type: 'unknown', boxSize: -1 }
    }

    /**
     * read an n-byte unsigned number
     * @param buff
     * @param ptr
     * @param boxSize
     * @returns {number}
     */
    static readUIntNBE (buff, ptr, boxSize) {
      if (!boxSize) throw new Error('readUIntNBE error: need a boxsize')
      let result = 0 | 0
      for (let i = ptr; i < ptr + boxSize; i++) {
        result = ((result << 8) | buff[i])
      }
      return result
    }

    static array2hex (array) { // buffer is an ArrayBuffer
      return Array.prototype.map.call(new Uint8Array(array, 0, array.byteLength), x => ('00' + x.toString(16)).slice(-2)).join(' ')
    }
  }

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
      this.p.activeChild = undefined
      this.p.ended = false
      this.p.ptr = 0
      this.p.type = type
      if (parent) {
        if (parent.p.ended) throw new Error('cannot create a child atom from an ended parent')
        if (parent.p.activeChild) throw new Error('cannot create a new child without ending the previous one')
        this.p.parent = parent
        parent.p.activeChild = this
        /* leave room for the length */
        this.p.ptr = 4
        /* spit out the box name */
        this.fourcc(fourcc, 'box name')
      }
      this.p.length = 0
      this.p.childCount = 0
      this.flushcount = 0
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
      if (typeof item !== 'string' || item.length !== 4) {
        throw new Error('bad fourcc')
      }
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
        if (typeof this.onbufferavailable === 'function') {
          const data = this.p.buffer.subarray(0, this.p.ptr)
          this.onbufferavailable(data)
        }
        this.p.ptr = 0
        this.p.length = 0
      } else {
        /* child item, write the length into the box */
        this.uint32At(this.p.ptr, 0, 'length')
        /* write the box into the parent box */
        this.p.parent.addchild(this)
        this.p.parent.p.activeChild = undefined
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

    static concatArrays (arrs) {
      let length = 0
      for (let i = 0; i < arrs.length; i++) length += arrs[i].byteLength
      const dest = new Uint8Array(length)
      let p = 0
      for (let i = 0; i < arrs.length; i++) {
        dest.set(arrs[i], p)
        p += arrs[i].byteLength
      }
      return dest
    }
  }

  class StreamBox extends Box {
    /**
     * end the streambox. Wreck it so it can't be reused.
     */
    end () {
      if (this.p.ended) throw new Error('cannot end() an atom more than once')
      if (this.p.parent) throw new Error('StreamBox cannot have a parent')
      this.p.ended = true
      this.requestData()
      this.p = undefined
    }

    /**
     *
     */
    requestData () {
      const data = this.p.buffer.slice(0, this.p.ptr)
      this.p.ptr = 0
      this.p.length = 0
      if (typeof this.onbufferavailable === 'function') {
        this.onbufferavailable(data)
      }
    }

    /**
     * this is for testing only
     */
    scribble () {
      this.uint32At(0xdeadbeef, 0, 'scribble')
      this.uint32At(0xdeadbeef, 4, 'scribble')
      if (this.p.ptr + 4 < this.p.max) this.uint32At(0xdeadbeef, this.p.ptr, 'scribble')
      if (this.p.ptr + 8 < this.p.max) this.uint32At(0xdeadbeef, this.p.ptr + 4, 'scribble')
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

  /**
   * Movie header
   * See https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap2/qtff2.html#//apple_ref/doc/uid/TP40000939-CH204-32947
   */
  class MvhdAtom extends Box {
    constructor (parent, options) {
      super('mvhd', parent, { initialSize: 120 })
    }

    populate ({
      creationTime = 0,
      modificationTime = 0,
      timeScale = 1000,
      duration = 0,
      rate = 1,
      volume = 0x0100,
      previewTime = 0,
      previewDuration = 0,
      posterTime = 0,
      selectionTime = 0,
      selectionDuration = 0,
      currentTime = 0,
      nextTrack = 0xffffffff
    }) {
      this.uint32(0, 'flags')
      this.uint32(creationTime, 'creationTime')
      this.uint32(modificationTime, 'notificationTime')
      this.uint32(timeScale, 'time scale') /* ticks per second. 1000 means milliseconds */
      this.uint32(duration)
      this.ufixed32(rate, 'playback rate') /* 1 means normal */
      this.uint16(volume, 'volume') /* 16-bit fixed-point number */
      this.zeros(2, 'reserved1')
      this.zeros(8, 'reserved2')
      this.uint32([0x00010000, 0, 0], 'matrix')
      this.uint32([0, 0x00010000, 0])
      this.uint32([0, 0, 0x40000000])
      this.uint32(previewTime, 'preview time')
      this.uint32(previewDuration, 'preview duration')
      this.uint32(posterTime, 'poster time')
      this.uint32(selectionTime, 'selection time')
      this.uint32(selectionDuration, 'selection duration')
      this.uint32(currentTime, 'current time')
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
     * @param sequenceNumber
     * @returns {MfhdAtom}
     */
    populate ({ sequenceNumber = 1 }) {
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
      firstSampleFlags = 0x2000000,
      sampleDuration,
      sampleSize
    }) {
      this.uint32(flags, 'flags')
      this.uint32(sampleCount, 'sample count')
      this.uint32(dataOffset, 'data offset') // TODO can we generate this?
      this.uint32(firstSampleFlags)
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
    new MehdAtom(mvex).populate(options).end()
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
          const stbl = new StblAtom(minf).populate({})
          {
            const stsd = new StsdAtom(stbl).populate({})
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
   *  helper function to create trex (track extension)
   * @param parent
   * @param trackId
   */
  function trexVideo (parent, { trackId }) {
    new TrexAtom(parent).populate({ trackId }).end()
  }

  function frame (parent, options, timestamp, duration, payload) {
    const moof = new MoofAtom(parent)
    new MfhdAtom(moof, {}).populate(options).end()
    const traf = new TrafAtom(moof)
    new TfhdAtom(traf).populate(options).end()
    new TfdtAtom(traf).populate({ baseMediaDecodeTime: timestamp }).end()
    const trunOptions = {
      dataOffset: 112, // TODO HACK HACK
      sampleDuration: duration,
      sampleSize: payload.byteLength
    }
    new TrunAtom(traf).populate(trunOptions).end()
    traf.end()
    moof.end()
    new MdatAtom(parent).populate({ payload }).end()
    return parent
  }

  class MediaTransboxer {
    constructor (options) {
      /* instance props */
      this.decoderOptions = {}
      this.webmValues = {}
      this.webmPath = []
      this.bufferHandler = function () {
      } /* stub */
      this.onfinish = function (ev) { /* stub */
      }
      this.payloadCounter = 0
      this.type = 'video/mp4 codecs="avc1.42C01E"'
      this.counts = { packets: 0, bytes: 0, blocks: 0 }
      this.timecodeScale = 1 /* milliseconds per clock tick */
      this.clusterTimecode = 0
      this.writeInProgress = 0
      this.previousSampleTime = 0
      this.timestampOffset = 0
      this.endDeferred = false
      this.deboxed = this.deboxedCallback.bind(this)
      /* ctor logic */
      if (!options) options = {}
      if (typeof options.type === 'string') {
        this.type = options.type
      }
      const boxOptions = {}
      boxOptions.type = this.type
      if (typeof options.initialSize === 'number') boxOptions.initialSize = options.initialSize
      this.streamBox = new StreamBox(null, null, boxOptions)
      this.ebmlDecoder = new EbmlDecoder()

      this.streamBox.onbufferavailable = (data) => {
        if (typeof this.bufferHandler === 'function') this.bufferHandler(data)
      }
    }

    get onbufferavailable () {
      return this.bufferHandler
    }

    set onbufferavailable (handler) {
      this.bufferHandler = handler
    }

    writeBuffer (arrayBuffer) {
      this.ebmlDecoder.write(arrayBuffer, this.deboxed)
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

    deboxedCallback (chunk) {
      const name = chunk[1].name
      if (chunk[0] === 'start') this.webmPath.push(name)
      else if (chunk[0] === 'end') this.webmPath.pop()
      else if (chunk[0] === 'tag') {
        let val
        const pathname = this.webmPath.join('.') + '.' + name
        switch (name) {
          case 'SimpleBlock':
            this.counts.blocks += 1
            this.handlePayload(chunk[1])
            break
          case 'PixelWidth':
            val = chunk[1].value
            this.webmValues[pathname] = val - val % 2
            break
          case 'PixelHeight':
            this.webmValues[pathname] = chunk[1].value
            break
          case 'TimecodeScale':
            /* in webm, this value is in nanoseconds per clock tick
             * and we want it in milliseconds */
            this.timecodeScale = 1000000 / chunk[1].value
            this.webmValues[pathname] = chunk[1].value
            break
          case 'Timecode':
            /* the cluster timecode */
            this.clusterTimecode = chunk[1].value
            this.webmValues[pathname] = chunk[1].value
            break
          default:
            if (chunk[1].value) {
              this.webmValues[pathname] = chunk[1].value
            }
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

      const naluStream = new NALUStream(box.payload, this.decoderOptions)

      if (this.payloadCounter === 0) {
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
      if (this.payloadCounter === 0) {
        options.codecPrivate = new AvcC({ naluStream: naluStream }).avcC
        /* ftyp / moov output */
        ftyp(this.streamBox)
        moov(this.streamBox, options,
          (parent, options) => {
            trakVideo(parent, options)
          },
          (parent, options) => {
            /* make each trackextension in turn, we only have one video track here. */
            options.trackId = 1
            trexVideo(parent, options)
          }
        )
      }
      this.sampleTime = timestamp - (this.timestampOffset * this.payloadCounter)
      this.duration = Math.max(1, timestamp - this.previousSampleTime)
      // TODO setting this duration to the actual frame duration makes MSE stop playing
      //  after some random amount of time. Why?
      frame(this.streamBox, options, this.previousSampleTime, 1000, naluStream.buf)
      this.streamBox.requestData()
      this.previousSampleTime = timestamp
      this.payloadCounter += 1
    }
  }

  let transBoxingMediaRecorderInstanceNumber = 0

  /**
   * Same interface as MediaRecorder
   */
  class TransboxingMediaRecorder {
    /**
     * Returns `true` if the MIME type specified is one the polyfill can record.
     *
     * This polyfill supports only `image/jpeg`.
     *
     * @param {string} mimeType The mimeType to check.
     * @return {boolean} true or false
     */
    static isTypeSupported (mimeType) {
      const transboxed = mimeType.replace(/\/mp4;/, '/webm;')
      // eslint-disable-next-line no-undef
      return MediaRecorder.isTypeSupported(transboxed)
    }

    constructor (stream, options) {
      // noinspection JSUnusedGlobalSymbols
      this.instanceNumber = transBoxingMediaRecorderInstanceNumber++
      this.stream = stream

      if (options && typeof options.mimeType === 'string') {
        this.requestedMime = options.mimeType
        this.transboxedMime = this.requestedMime.replace(/\/mp4;/, '/webm;')
      } else {
        throw new Error('please provide a valid mp4 MIME type')
      }
      // eslint-disable-next-line no-undef
      if (!MediaRecorder.isTypeSupported(this.transboxedMime)) {
        throw new Error('NotSupportedError: mimeType ' + options.mimeType + ' unknown')
      }

      /**
       * Event handler when data is ready
       * @type {function}
       */
      this.dataAvailableHandler = undefined

      /* cheezy deep copy. cost doesn't matter, we only do it once */
      this.mediaRecorderOptions = JSON.parse(JSON.stringify(options))
      this.mediaRecorderOptions.mimeType = this.transboxedMime
      // eslint-disable-next-line no-undef
      this.mediaRecorder = new MediaRecorder(this.stream, this.mediaRecorderOptions)
      this.mediaTransboxer = new MediaTransboxer()
      this.mediaRecorder.ondataavailable = this.mediaRecorderDataHandler.bind(this)
      this.mediaTransboxer.onbufferavailable = this.bufferHandler.bind(this)
    }

    mediaRecorderDataHandler (ev) {
      if (this.mediaTransboxer) {
        ev.data.arrayBuffer()
          .then(arrayBuffer => {
            if (this.mediaTransboxer) {
              this.mediaTransboxer.writeBuffer(new Uint8Array(arrayBuffer))
            }
          })
      }
    }

    get state () {
      return this.mediaRecorder.state
    }

    requestData () {
      this.mediaRecorder.requestData()
    }

    start (timeslice) {
      this.mediaRecorder.start(timeslice)
    }

    stop () {
      this.mediaRecorder.ondataavailable = undefined
      this.mediaRecorder.stop()
      this.mediaTransboxer = undefined
    }

    pause () {
      this.mediaRecorder.pause()
    }

    resume () {
      this.mediaRecorder.resume()
    }

    set ondataavailable (handler) {
      if (handler && typeof handler === 'function') {
        this.dataAvailableHandler = handler.bind(this)
      } else {
        this.dataAvailableHandler = undefined
      }
    }

    get ondataavailable () {
      return this.dataAvailableHandler
    }

    addEventListener (eventName, handler) {
      this.mediaRecorder.addEventListener(eventName, handler)
    }

    removeEventListener (eventName, handler) {
      this.mediaRecorder.removeEventListener(eventName, handler)
    }

    bufferHandler (buffer) {
      if (typeof this.dataAvailableHandler === 'function') {
        if (this.weEverGotUnhandledData) {
          throw new Error('cannot provide ondataavailable handler to transboxer midstream')
        }
        // eslint-disable-next-line no-undef
        const data = new Blob([buffer], { type: this.requestedMime })
        this.dataAvailableHandler({ data })
      } else {
        this.weEverGotUnhandledData = true
      }
    }
  }

  return { TransboxingMediaRecorder }
})()
