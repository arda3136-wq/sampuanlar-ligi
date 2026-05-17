# Şampuanlar Ligi

Backend'li ve yayınlanabilir lig sitesi.

## Admin Bilgisi

Admin kullanıcı adı ve şifre artık `index.html` içinde değildir. Yayınlama panelinde gizli ortam değişkeni olarak ayarlanır:

- `ADMIN_USER`
- `ADMIN_PASS`
- `ADMIN_SECRET`
- `DATA_DIR`

Yerel test için örnek değerler `.env.example` dosyasında durur. Gerçek şifreyi `.env.example` içine yazma.

## Çalıştırma

```bash
npm start
```

## Kalıcı Yayınlama

Render için `render.yaml` hazırlandı. Kalıcı veri için disk kullanır. `plan: starter` kapanmayan kullanım içindir; ücretsiz planlar genelde uykuya geçebilir.

Render panelinde bu değerleri gir:

- `ADMIN_USER`: admin kullanıcı adın
- `ADMIN_PASS`: admin şifren
- `ADMIN_SECRET`: uzun ve rastgele bir gizli anahtar

Sonra servis yayınlanınca verilen Render linki kalıcı site adresin olur.
