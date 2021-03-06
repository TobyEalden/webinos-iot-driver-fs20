(function () {

  //
  // Private constants
  // -----------------
  
  // States
  var ST_UNKNOWN = -1;
  var ST_WAITING_LENGTH = 0;
  var ST_WAITING_TYPE = 1;
  var ST_WAITING_CRC = 2;
  var ST_WAITING_DATA = 3;
  var ST_COMPLETE = 999;

  // Parsing constants
  var START_BYTE = 0x81;
  
  // Constructor
  function fs20Packet() {
    this.state = ST_UNKNOWN;
    this.dataLength = 0;
    this.expectedCRC = 0;
    this.dataType = 0;
    this.headerLength = 0;
    this.crc = 0;
    this.packet = [];
  }

  //
  // Public constants
  // ----------------
  fs20Packet.FHT_RECEIVE_PREFIX = "0909a001";
  
  //
  // Public instance methods
  // -----------------------
  
  // Parse method
  fs20Packet.prototype.parse = function(data,cb) {
    for (var i = 0; i < data.length; i++) {
      this.doParse(data[i]);
    }

    if (this.state === ST_COMPLETE) {
      if (this.crc % 256 == this.expectedCRC) {
        if (this.getTarget() === fs20Packet.FHT_RECEIVE_PREFIX) {
          cb(true);
        } else { 
          console.log("ignoring packet, target code not FHT - " + this.getTarget());
          cb(false);
        }
      } else {
        console.log("CRC error - got " + this.crc + " expected " + this.expectedCRC);
        cb(false);
      }
    }
  };
  
  fs20Packet.prototype.parseString = function(str,cb) {
    return this.parse(new Buffer(str,'hex'),cb);
  };

  // Parse helper - this should really be private.
  fs20Packet.prototype.doParse = function(bufByte) {
    switch (this.state) {
      case ST_UNKNOWN:
      case ST_COMPLETE:
        if (bufByte == START_BYTE) {
          this.state = ST_WAITING_LENGTH;
          this.packet = [];
          this.crc = 0;
        } else {
          console.log("unexpected start byte: " + bufByte);
        }
        break;
      case ST_WAITING_LENGTH:
        this.dataLength = bufByte;
        this.state = ST_WAITING_TYPE;
        break;
      case ST_WAITING_TYPE:
        this.dataType = bufByte;
        this.state = ST_WAITING_CRC;
        break;
      case ST_WAITING_CRC:
        this.expectedCRC = bufByte;
        this.state = ST_WAITING_DATA;
        this.headerLength = this.packet.length+1;  
        break;
      case ST_WAITING_DATA:
        this.crc += bufByte;
        if (this.packet.length + 1 === this.dataLength + 2) {
          this.state = ST_COMPLETE;
        }
        break;
      default:
        console.log("invalid datagram - bad state!");
        break;
    }
    
    this.packet.push(bufByte);
  };
  
  fs20Packet.prototype.getRaw = function() {
    return new Buffer(this.packet);
  };
  
  fs20Packet.prototype.get = function(idx) {
    if (idx > 2) {
      idx++;
    }
    return this.packet[this.headerLength + fs20Packet.FHT_RECEIVE_PREFIX.length/2 + idx];
  };

  fs20Packet.prototype.getData = function() {
    return this.packet.slice(this.headerLength);
  };
  
  fs20Packet.prototype.getTarget = function() {
    return this.toString().substr(this.headerLength*2,fs20Packet.FHT_RECEIVE_PREFIX.length);
  };
  
  fs20Packet.prototype.fromString = function(str) {
    this.packet = [];
    this.packet[0] = START_BYTE;
    this.packet[1] = 0;                     // Length placeholder
    this.packet[2] = this.dataType = 0x04;  // Telegram type
    this.packet[3] = 0;                     // CRC placeholder
    this.headerLength = this.packet.length;
        
    this.crc = 0;
    for (var i = 0; i < str.length; i+=2) {
      var val = (parseInt(str[i],16) << 4) + parseInt(str[i+1],16);
      this.packet.push(val);
      this.crc += val;
    }    

    this.packet[1] = this.packet.length - 2;      // Replace length placeholder.
    this.packet[3] = this.expectedCRC = this.crc; // Replace CRC placeholder.
  };

  fs20Packet.prototype.fromCUL = function(culPacket) {
    var converted = "0909a001" + culPacket.substr(1,6) + "00" + culPacket.substr(7,4);
    return this.fromString(converted);
  };
  
  fs20Packet.prototype.toString = function() {
    var str = "";
    for (var i in this.packet) {
      // Zero-pad as 2-digit hex value
      str = str + ("00" + this.packet[i].toString(16)).substr(-2);
    }
    return str;
  };

  fs20Packet.prototype.toCULString = function() {
    var fs20String = this.toString();
    return "T" + fs20String.substr(16,6) + fs20String.substr(24,4);
  };
      
  // Public static methods
  fs20Packet.publicStatic = function() {
    console.log("public static template");
  };
    
  // Private static methods
  var privateStatic = function() {
    console.log("private static template");
  };
  
  module.exports = fs20Packet;

})();