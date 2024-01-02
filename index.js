const express = require ('express')
const ejsMate = require('ejs-mate')
require('dotenv').config();
const path = require('path')
const mongoose = require('mongoose')
const app = express()



const formulirPasien = require ('./models/formulirPasien')
const kartuBerobat = require('./models/kartuBerobat')
const BPJS = require('./models/asuransi/bpjs')
const pasienRawatInap = require('./models/pasienRawatInap')
// setup databases
// const PORT = 3000;
// const databases = "Data"
// mongoose.connect(`mongodb://127.0.0.1/${databases}`)
// .then((result)=>{
//     console.log(`Connected to Mongodb(${databases})`)
// }).catch((err)=>{
//     console.log(err)
// })

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(`MongoDB Connected`);
    } catch (error) {
        console.error('Error connecting to MongoDB:', error.message);
        process.exit(1);
    }
};
connectDB();

app.engine('ejs',ejsMate)
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'front-end'))
app.use(express.static('public'));
app.use(express.static(path.join(__dirname,'public')))
app.use(express.urlencoded({extended:true}))


app.get('/',(req,res)=>{
    res.render('admin/dasboard')
})
app.get('/formulirpasien', (req,res)=>{
    res.render('admin/pendaftaran/formulirpasien')
})
//  admin (kartuberobat)
app.get('/kartuberobat',(req,res)=>{
    res.render('admin/pendaftaran/kartuberobat')
})
app.post('/saveKartuBerobat', async (req, res) => {
    const savekartuBerobat = kartuBerobat(req.body.kartuBerobat);
    await savekartuBerobat.save();
    console.log(savekartuBerobat);
    res.render('print/printKartuBerobat', { saveKartuBerobat: savekartuBerobat });
});

// print
app.get('/kartuberobat/cetak', (req,res)=>{
    res.render('print/printKartuBerobat')
})

// admin(formulirpasien)
app.get('/formulirpasien',(req,res)=>{
    res.render('admin/pendaftaran/formulirpasien')
})


app.post('/saveformulirpasien', async (req, res) => {
    try {
        const kodeRegistrasiInput = req.body.formulirPasien.kodeRegistrasiKartu;
        const kodeRegistrasiKartu = await kartuBerobat.findOne({ kodeRegistrasi: kodeRegistrasiInput });

        if (kodeRegistrasiKartu) {
            const pasienData = req.body.formulirPasien;

            // Ensure that 'asuransi' is a string, not an array
            if (Array.isArray(pasienData.asuransi)) {
                pasienData.asuransi = pasienData.asuransi[0];
            }

            const pasien = new formulirPasien(pasienData);
            pasien.kodeRegistrasi = kodeRegistrasiKartu._id;
            await pasien.save();

            if (pasien.asuransi === 'BPJS') {
                const bpjsData = new BPJS({
                    asuransi: pasien._id,
                });
                await bpjsData.save();
            }

            // Log BPJS data
            const tanggalFormattedMasuk = pasien.getMonthYearDateMasuk();
            const tanggalFormattedLahir = pasien.getMonthYearDateLahir();

            console.log("Data Pasien:", pasien);
            console.log("Kode Registrasi Pasien:", pasien.kodeRegistrasi);

            res.render('print/printPendaftaranPasien', {
                saveDataPasien: pasien,
                kodeRegistrasiKartu,
                tanggalFormattedMasuk,
                tanggalFormattedLahir,
                successMessage: 'Data berhasil disimpan.',
            });
        } else {
            res.status(404).send('Data kartuBerobat tidak ditemukan.');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Terjadi kesalahan saat mengambil atau menyimpan data.');
    }
});



app.get('/saveformulirpasien/cetak', (req,res)=>{
    res.render('print/printPendaftaranPasien')
})




// daftar pasien 
app.get('/daftarpasien', async (req,res)=>{
    const pasiens = await formulirPasien.find()
    res.render('admin/daftarpasien' , {pasiens})
})

app.get('/daftarkunjungan',(req,res)=>{
    res.render('admin/daftarkunjungan')
})
app.get('/asuransi', async (req, res) => {
    try {
        const bpjs = await BPJS.find().populate('asuransi');
        console.log(bpjs);
        res.render('admin/asuransi', { bpjs });
    } catch (error) {
        console.error(error);
        res.status(500).send('Terjadi kesalahan saat mengambil data BPJS.');
    }
});

// laporan
app.get('/laporan/harian',(req,res)=>{
    res.render('rawatInap/laporan/harian')
})
app.get('/laporan/mingguan',(req,res)=>{
    res.render('rawatInap/laporan/mingguan')
})
app.get('/laporan/bulanan',(req,res)=>{
    res.render('rawatInap/laporan/bulanan')
})


// app.get('',(req,res)=>{
//     res.render('admin/daftarpasien')
// })

app.get('/rawatinap/dasboard', async(req,res)=>{
    res.render('rawatInap/dasboard')
})

app.get('/tambah-data-pasien-rawat-inap',async(req,res)=>{

    try {
        const pasienRawatInap = await formulirPasien.find({ poli: 'Rawat Inap' });
        console.log(pasienRawatInap)
        if (pasienRawatInap.length > 0) {
            res.render('rawatInap/tambahDataPasienRawatInap', { pasienRawatInap });
        } else {
            res.render('rawatInap/tambahDataPasienRawatInap', { pasienRawatInap: null });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Terjadi kesalahan dalam mengambil data pasien rawat inap');
    }
    
})

// pencarian nomor noPendaftaran 
app.get('/cari-pasien', async (req, res) => {
    try {
        const noPendaftaran = req.query.noPendaftaran;
        if (!noPendaftaran) {
            res.status(400).json({ error: 'Nomor pendaftaran tidak ditemukan.' });
            return;
        }

        const pasienRawatInap = await formulirPasien.findOne({ noPendaftaran: noPendaftaran, poli: 'Rawat Inap' });

        if (pasienRawatInap) {

            console.log(pasienRawatInap);

            // Mengembalikan data pasien sebagai respons JSON
            res.json({ pasienRawatInap, noPendaftaran });
        } else {
            // Mengembalikan pesan jika pasien tidak ditemukan
            res.status(404).json({ error: 'Pasien tidak ditemukan.' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan dalam mencari data pasien rawat inap' });
    }
});

app.post('/isiDataPasienRawatInap/save', async (req, res) => {
    try {
        const { formulirId } = req.body.pasienRawatInap;
        // Dapatkan formulir dari database berdasarkan formulirId
        const formulir = await formulirPasien.findById(formulirId);
        if (!formulir) {
            return res.status(404).json({ message: 'Formulir pendaftaran tidak ditemukan' });
        }
        // Buat objek pasienRawatInap yang baru
        const pasien = new pasienRawatInap({
            noPendaftaran: formulirId, // Menggunakan formulirId sebagai noPendaftaran
            ...req.body.pasienRawatInap,
        });
        await pasien.save();
        // Populasikan data pasienRawatInap
        const pasienWithPopulate = await pasienRawatInap.findById(pasien._id).populate('noPendaftaran');
        // Perbarui formulirPasien dengan ID pasienRawatInap
        formulir.pasienRawatInapId = pasien._id;
        await formulir.save();
        // Render tanggapan
        res.redirect('/rawatInap/daftarPasien');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Terjadi kesalahan dalam menyimpan data pasien rawat inap' });
    }
});

app.get('/rawatInap/daftarPasien', async (req, res) => {
    try {
        // Menggunakan fungsi `populate` untuk mengisi data pasienRawatInap dengan data formulirPasien
        const semuaDataPasien = await pasienRawatInap.find()
            .populate('noPendaftaran');

        console.log('isi semua data', semuaDataPasien);
        res.render('rawatInap/daftarPasien', { pasienRawatInap: semuaDataPasien });
    } catch (error) {
        console.error('Error dalam mendapatkan data pasien rawat inap:', error);
        res.status(500).json({ message: 'Terjadi kesalahan dalam mengambil data pasien rawat inap', error });
    }
});





// app.post('/isiDataPasienRawatInap/save', async (req, res) => {
//     // try {
//         const { formulirId } = req.body.pasienRawatInap;
//          await console.log(formulirId)

//         const formulir = await formulirPasien.find();
//         await console.log(formulir)
// })
    //     
        
    //     if (!formulir) {
    //         return res.status(404).json({ message: 'Formulir pendaftaran tidak ditemukan' });
    //     }

    //     // Buat objek pasienRawatInap yang baru
    //     const pasien = new pasienRawatInap({
    //         noPendaftaran: id,
    //         ...req.body.pasienRawatInap,
    //     });
    //     await pasien.save();

    //     // Populasikan data pasienRawatInap
    //     const pasienWithPopulate = await pasienRawatInap.findById(pasien._id).populate('noPendaftaran');

    //     // Perbarui formulirPasien dengan ID pasienRawatInap
    //     formulir.pasienRawatInapId = pasien._id;
    //     await formulir.save();

    //     // Render tanggapan
    //     res.render('rawatInap/detaildatapasien', { message: 'Berhasil menambahkan PasienRawatInap', pasienRawatInap: pasienWithPopulate });
    // } catch (error) {
    //     console.error('Error:', error);
    //     res.status(500).json({ message: 'Terjadi kesalahan dalam menyimpan data pasien rawat inap' });
    // }
// });






// Perawat
// app.get('/rawatinap/pasien', async (req, res) => {
//     try {
//         const pasienRawatInap = await formulirPasien.find({ poli: 'Rawat Inap' });
//         console.log(pasienRawatInap)
//         if (pasienRawatInap.length > 0) {
//             res.render('rawatInap/daftarPasien', { pasienRawatInap });
//         } else {
//             res.render('rawatInap/daftarPasien', { pasienRawatInap: null });
//         }
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).send('Terjadi kesalahan dalam mengambil data pasien rawat inap');
//     }
// });

// 



app.get('/rawatinap/detail/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pasienWithPopulate = await pasienRawatInap.findById(id).populate('noPendaftaran');
        if (!pasienWithPopulate) {
            return res.status(404).render('error', { message: 'Data Pasien Rawat Inap tidak ditemukan' });
        }
        res.render('rawatInap/detail', { pasienRawatInap: pasienWithPopulate });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).render('error', { message: 'Terjadi kesalahan dalam mengambil data pasien rawat inap' });
    }
});












//laporan perawat
app.get('/rawatinap/laporan/harian',(req,res)=>{
    res.render('rawatInap/laporan/harian')
})
app.get('/rawatinap/laporan/mingguan',(req,res)=>{
    res.render('rawatInap/laporan/mingguan')
})
app.get('/rawatinap/laporan/bulanan',(req,res)=>{
    res.render('rawatInap/laporan/bulanan')
})
//farmasi & logistik
app.get('/rawatinap/farmasilogistik/harian',(req,res)=>{
    res.render('rawatInap/farmasiLogistik/harian')
})
app.get('/rawatinap/farmasilogistik/mingguan',(req,res)=>{
    res.render('rawatInap/farmasiLogistik/mingguan')
})
app.get('/rawatinap/farmasilogistik/bulanan',(req,res)=>{
    res.render('rawatInap/farmasiLogistik/bulanan')
})
// data kamar dan permintaan makan
app.get('/rawatinap/datakamar', (req,res)=>{
    res.render('rawatinap/dataKamar')
})
app.get('/rawatinap/pasien/control', (req,res)=>{
    res.render('rawatinap/control')
})



// app.listen(PORT,()=>{
//     console.log(`Server is running on http://127.0.0.1:${PORT}`)
// })

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Listening On Port http://127.0.0.1:${PORT}`);
});



// const getMonthYearDateMasuk = function(tanggalMasuk) {
//     if (tanggalMasuk) {
//         const options = { year: 'numeric', month: 'long', day: 'numeric' };
//         return new Date(tanggalMasuk).toLocaleDateString('id-ID', options);
//     } else {
//         return 'Tanggal Masuk Tidak Tersedia';
//     }
// };

// const getMonthYearDateLahir = function(tanggalLahir) {
//     if(tanggalLahir) {
//         const options = { year: 'numeric', month: 'long', day : 'numeric'};
//         return new Date(tanggalLahir).toLocaleDateString('id-ID', options);
//     }return "Tanggal Lahir Tidak Tersedia"
// }




// router.get('/formulirPasienByKartu/:kodeRegistrasiKartu', async (req, res) => {
//     try {
//         const kodeRegistrasiInput = req.params.kodeRegistrasiKartu;

//         // Cari kartuBerobat berdasarkan kode registrasi
//         const kartuBerobatData = await kartuBerobat.findOne({ kodeRegistrasi: kodeRegistrasiInput });

//         if (kartuBerobatData) {
//             // Ambil formulirPasien yang terkait dengan kartuBerobat dan "populate" kodeRegistrasi
//             const formulirPasienList = await formulirPasien
//                 .find({ kodeRegistrasi: kartuBerobatData._id })
//                 .populate('kodeRegistrasi');  // Populate kartuBerobat
            
//             res.json({ formulirPasienList });
//         } else {
//             res.status(404).json({ error: 'Data kartuBerobat tidak ditemukan.' });
//         }
//     } catch (error) {
//         console.error(error.message);
//         res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data.' });
//     }
// });