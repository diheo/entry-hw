var ENABLE = 0x01;
var VERSION_MAJOR = 0x02;
var VERSION_MINOR = 0x05;
var SET_PIN_MODE = 0xF4;
var END_SYSEX = 0xF7;
var QUERY_FIRMWARE = 0x79;
var REPORT_VERSION = 0xF9;
var DIGITAL_MESSAGE = 0x90;
var RESET = 0xFF;
var CONNECTION_STATE = 0xFF;
var ANALOG_REPORT = 0xC0;
var DIGITAL_REPORT_LOW_CHANNEL = 0xD0;
var DIGITAL_REPORT_HIGH_CHANNEL = 0xD1;

// INPUT/OUTPUT/ANALOG/  PWM / SERVO /  I2C / ONEWIRE / STEPPER / ENCODER / SERIAL / PULLUP
// 0x00 / 0x01 / 0x02 / 0x03 / 0x04  / 0x06 /  0x07   /   0x08  /  0x09   /  0x0A  / 0x0B

var INPUT = 0;
var OUTPUT = 1;
var ANALOG = 2;
var PWM = 3;
var SERVO = 4;

function Module() {
    this.digitalValue = new Array(7);
    this.analogValue = new Array(6);
    this.remoteDigitalValue = new Array(14);
    this.sendFlag = false;
    this.ports = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
    this.digitalData = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
    this.digitalPinMode = [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ];
    this.analogEnable = [ 0, 0, 0, 0, 0, 0 ];
};

Module.prototype.init = function(handler, config) {    
};

Module.prototype.requestInitialData = function() {    
    return this.roduinoInit();
};

Module.prototype.checkInitialData = function(data, config) {
    return true;
};

Module.prototype.validateLocalData = function(data) {
    return true;
};

Module.prototype.handleRemoteData = function(handler) {
    var digitalValue = this.remoteDigitalValue;
    for (var i = 0; i < 5; i++) {
        digitalValue[i] = handler.read(i);
    }
};

Module.prototype.requestLocalData = function() {
    var query = [];
    var temp = [];
    
    // 1 : digital_read, 2 : set_pin_mode, 3 : digital_write, 4 : analog_write, 5 : analog_read, 6 : motor, 7: color, 
    switch(this.remoteDigitalValue[0]) {
        case 1:
            this.sendFlag = true;
            temp = this.setPinMode(this.remoteDigitalValue[1], INPUT);
            if(temp != null) {
                for(var i = 0; i < temp.length; i++) {
                    query.push(temp[i]);
                }
            }            
        break;
        case 2 :            
        break;
        case 3 :
            this.sendFlag = true;
            temp = this.setPinMode(OUTPUT);
            if(temp != null) {
                for(var i = 0; i < temp.length; i++) {
                    query.push(temp[i]);
                }
            }
            temp = this.digitalWrite();
            for(var i = 0; i < temp.length; i++) {
                query.push(temp[i]);
            }
        break;
        case 4 :
            this.sendFlag = true;
        break;
        case 5 :
            this.sendFlag = true;
            query = this.setAnalogEnable(1);
        break;
        case 6 :
            this.sendFlag = true;
            query = this.motor();
        break;
        case 7:
            this.sendFlag = true;
            query = this.setColor();
        break;
        default:
            if(this.sendFlag == true) {
                this.sendFlag = false;                
                query = this.sendReset();
            }
        break;
    }
    
    query.push(DIGITAL_REPORT_LOW_CHANNEL);
    query.push(ENABLE);
    
    query.push(DIGITAL_REPORT_HIGH_CHANNEL);
    query.push(ENABLE);
    
    return query;
};

Module.prototype.handleLocalData = function(data) { // data: Native Buffer    
    for(var i = 0; i < data.length; i += 3) {
        var cmd = data[i];
        var LSB = data[i + 1];
        var MSB = data[i + 2];
        
        if(cmd == DIGITAL_MESSAGE) {
            if(MSB == 0) {
                var temp = 0;
                for(var pin = 2; pin < 8; pin++) {
                    temp = LSB & (1 << pin);
                    if(temp != 0) {
                        this.digitalValue[pin - 2] = 1;
                    } else {
                        this.digitalValue[pin - 2] = 0;
                    }
                }
            } else {
                this.digitalValue[5] = 1;
            }
        } else if(cmd == DIGITAL_MESSAGE + 1) {
            if(LSB == 1) {
                this.digitalValue[6] = 1;
            } else {
                this.digitalValue[6] = 0;
            }
        } else {
            var pin = data[0] & 0x0F;
            var value = data[1] | (data[2] << 7);
            if(value != 0) {
                this.analogValue[pin] = value;
            }
        }
    }
};

Module.prototype.requestRemoteData = function(handler) {
    for (var i = 0; i < this.analogValue.length; i++) {
        var value = this.analogValue[i];
        handler.write('a' + i, value);
    }
    
    for (var i = 0; i < this.digitalValue.length; i++) {
        var value = this.digitalValue[i];
        handler.write(i, value);
    }
};

Module.prototype.reset = function() {
};

module.exports = new Module();

Module.prototype.roduinoInit = function() {
    var queryString = [];
    
    queryString.push(0xAA);
    queryString.push(0xBB);
    queryString.push(0xCC);
    
    queryString.push(REPORT_VERSION);
    queryString.push(QUERY_FIRMWARE);
    queryString.push(END_SYSEX);
    
    return queryString;
};

Module.prototype.sendReset = function() {
    var queryString = [];

    this.digitalData = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
    this.digitalPinMode = [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ];
    this.analogEnable = [ 0, 0, 0, 0, 0, 0 ];
    queryString.push(RESET);
    
    return queryString;
};

Module.prototype.setPinMode = function(pin, mode) {
    var queryString = [];
    
    if(this.digitalPinMode[pin] != mode) {    
        queryString.push(SET_PIN_MODE);
        queryString.push(pin);
        queryString.push(mode);
        this.digitalPinMode[pin] = mode;
        
        return queryString;
    }
    
    return null;
}

Module.prototype.setAnalogEnable = function(flag) {
    var queryString = [];
    
    if(this.analogEnable[this.remoteDigitalValue[1]] != flag) {
        queryString.push(ANALOG_REPORT + this.remoteDigitalValue[1]);
        queryString.push(flag);
        this.analogEnable[this.remoteDigitalValue[1]] = flag;
        return queryString;
    }
    
    return null;
}

Module.prototype.digitalWrite = function() {
    var queryString = [];
    var ChannelData = [0, 0];
    var pin = this.remoteDigitalValue[1];
    var value = this.remoteDigitalValue[2];
    var port = pin >> 3;
    var mask = 1 << (pin % 8);
    
    if(value == 1) {
        this.ports[port] |= mask;
    } else {
        this.ports[port] &= ~mask;
    }    
    ChannelData[0] |= this.ports[port] & 0x7F;
    ChannelData[1] |= (this.ports[port] >> 7) & 0x7F;
    
    queryString.push(DIGITAL_MESSAGE | port);
    queryString.push(ChannelData[0]);
    queryString.push(ChannelData[1]);
    
    return queryString;
};

Module.prototype.motor = function() {
    var queryString = [];
    
    for(var i = 1; i < 5; i += 2) {
        var ChannelData = [0, 0];
        var pin = this.remoteDigitalValue[i];
        var value = this.remoteDigitalValue[i + 1];
        var port = pin >> 3;
        var mask = 1 << (pin % 8);
                
        if(value == 1) {
            this.ports[port] |= mask;
        } else {
            this.ports[port] &= ~mask;
        }    
        ChannelData[0] |= this.ports[port] & 0x7F;
        ChannelData[1] |= (this.ports[port] >> 7) & 0x7F;
        
        queryString.push(DIGITAL_MESSAGE | port);
        queryString.push(ChannelData[0]);
        queryString.push(ChannelData[1]);
    }
    return queryString;
};

Module.prototype.setColor = function() {
    var queryString = [];
    var temp = null;
    
    for(var i = 1; i < 4; i++) {
        temp = this.setPinMode(this.remoteDigitalValue[i], this.INPUT);
        if(temp != null) {
            for(var j = 0; j < temp.length; j++) {
                queryString.push(temp[j]);
            }
        }
    }    
    return queryString;
};