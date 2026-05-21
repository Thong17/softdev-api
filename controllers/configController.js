const jsrsasign = require('jsrsasign');
const fs = require("node:fs")

const privateKey = fs.readFileSync(process.env.QZ_TRAY_PRIVATE_KEY_PATH, "utf-8");
const certificate = fs.readFileSync(process.env.QZ_TRAY_CERTIFICATE_PATH, "utf-8");

exports.signQzCert = async (req, res) => {
    if (!req.body.data || !privateKey) {
        return res.status(400).json({ error: "Missing data or private key" });
    }
    const pk = jsrsasign.KEYUTIL.getKey(privateKey);
    const sig = new jsrsasign.KJUR.crypto.Signature({"alg": "SHA512withRSA"});  // Use "SHA1withRSA" for QZ Tray 2.0 and older
    sig.init(pk); 
    sig.updateString(req.body.data);
    const hex = sig.sign();
    res.json({ signature: jsrsasign.stob64(jsrsasign.hextorstr(hex)) });
}

exports.getCertificate = async (req, res) => {
    if (!certificate) {
        return res.status(400).json({ error: "Missing certificate in environment variables" });
    }
    res.json({ certificate });
}
