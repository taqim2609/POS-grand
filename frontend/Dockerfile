# Frontend disajikan sebagai file statis yang SUDAH di-build, agar Raspberry Pi
# TIDAK perlu menjalankan build berat / mengunduh node_modules (rawan gagal di
# koneksi lambat). Build dihasilkan sebelum push:
#   cd frontend && REACT_APP_BACKEND_URL="" yarn build
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
