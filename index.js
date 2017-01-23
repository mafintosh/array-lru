var hash = require('./crc16')

module.exports = LRU

function LRU (max, opts) {
  if (!(this instanceof LRU)) return new LRU(max, opts)
  if (!opts) opts = {}

  this.collisions = factorOfTwo(opts.collisions || opts.bucketSize || 4)
  this.buckets = factorOf(max, this.collisions) / this.collisions

  while (this.buckets > 65536) {
    this.buckets >>= 1
    this.collisions <<= 1
  }

  this.size = this.buckets * this.collisions
  this.cache = new Array(this.size)
  this.hash = this.buckets === 65536 ? hash : maskedHash(this.buckets - 1)
  this.evict = opts.evict || null
}

LRU.prototype.set = function (index, val) {
  var pageStart = this.collisions * this.hash(index)
  var pageEnd = pageStart + this.collisions
  var ptr = pageStart
  var page = null

  while (ptr < pageEnd) {
    page = this.cache[ptr]

    if (!page) {
      page = this.cache[ptr] = new Node(index, val)
      move(this.cache, pageStart, ptr, page)
      return
    }

    if (page.index === index) {
      page.value = val
      move(this.cache, pageStart, ptr, page)
      return
    }

    ptr++
  }

  if (this.evict) this.evict(page.index, page.value)

  // update oldest
  page.index = index
  page.value = val
  move(this.cache, pageStart, ptr - 1, page)
}

LRU.prototype.get = function (index) {
  var pageStart = this.collisions * this.hash(index)
  var pageEnd = pageStart + this.collisions
  var ptr = pageStart

  while (ptr < pageEnd) {
    var page = this.cache[ptr++]

    if (!page) return null
    if (page.index !== index) continue

    move(this.cache, pageStart, ptr - 1, page)

    return page.value
  }

  return null
}

function move (list, index, itemIndex, item) {
  while (itemIndex > index) list[itemIndex] = list[--itemIndex]
  list[index] = item
}

function Node (index, value) {
  this.index = index
  this.value = value
}

function factorOf (n, factor) {
  n = factorOfTwo(n)
  while (n & (factor - 1)) n <<= 1
  return n
}

function factorOfTwo (n) {
  if (n && !(n & (n - 1))) return n
  var p = 1
  while (p < n) p <<= 1
  return p
}

function maskedHash (mask) {
  return function (n) {
    return hash(n) & mask
  }
}
