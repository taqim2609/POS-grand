import openpyxl
cols = ["nama_produk","sku","kategori","tipe_produk","harga","status_aktif","sold_out","deskripsi","stok_awal"]
wb = openpyxl.Workbook(); ws = wb.active; ws.append(cols)
ws.append(["TEST_UI_IMP_OK","TEST-UI-IMP-1","Cemilan","retail",13000,"aktif","tidak","ok",25])
ws.append(["TEST_UI_IMP_BADCAT","TEST-UI-IMP-2","Kategori Palsu","retail",1000,"aktif","tidak","",0])
ws.append(["TEST_UI_IMP_NEG","TEST-UI-IMP-3","Cemilan","retail",-9,"aktif","tidak","",0])
wb.save("/tmp/ui_import.xlsx")
print("written")
