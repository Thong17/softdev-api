const jsrsasign = require('jsrsasign');
const fs = require("node:fs")

const privateKey = fs.readFileSync("static/private/private-key.pem", "utf-8");

exports.signQzCert = async (req, res) => {
    const pk = jsrsasign.KEYUTIL.getKey(privateKey);
    const sig = new jsrsasign.KJUR.crypto.Signature({"alg": "SHA512withRSA"});  // Use "SHA1withRSA" for QZ Tray 2.0 and older
    sig.init(pk); 
    sig.updateString(req.body.data);
    const hex = sig.sign();
    res.json({ signature: jsrsasign.stob64(jsrsasign.hextorstr(hex)) });
}

