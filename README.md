# Together — Ezgi & Aslı için kilo/alışkanlık takip uygulaması

Tek sayfalık bir mobil web uygulaması (vanilla HTML/CSS/JS) + gerçek, paylaşılan bir
backend (Vercel Serverless Functions + Upstash Redis). İki kişi kendi linkinden
girer, kendi verisini kaydeder, birbirinin *ilerlemesini* görür ama **gerçek kilo
asla karşı tarafa gösterilmez** — bu kural sunucu tarafında (`api/`) uygulanıyor,
yani tarayıcının network sekmesinden bakılsa bile karşı tarafın kilosu hiçbir
zaman veri olarak gönderilmiyor.

## Nasıl çalışıyor (mimari)

- `index.html` — tüm arayüz, tek dosya. Sunucuya `fetch` ile konuşuyor.
- `api/state.js`, `api/action.js` — Vercel Serverless Functions. Tüm veri
  buradan okunup yazılıyor.
- `lib/domain.js` — streak hesaplama, kilo/tarih mantığı gibi saf fonksiyonlar.
  Hem sunucu hem (yerel demo modunda) istemci aynı mantığı kullanıyor.
- `lib/kv.js` — veritabanı bağlantısı (Upstash Redis) + şimdilik-basit "auth":
  iki uzun rastgele kod (`TOKEN_A`, `TOKEN_B`) kimin kim olduğunu belirliyor.
  Gerçek bir login sistemi kurmak istediğinde değişmesi gereken TEK yer
  `resolveRole()` fonksiyonu — geri kalan hiçbir şeye dokunman gerekmiyor.

Kimlik doğrulama şimdilik gerçek bir "login" değil: Ezgi ve Aslı'ya birer gizli
kod/link veriyorsun, o kod hangi rol olduklarını belirliyor. Şifre yok, e-posta
yok — ama linki bilmeyen biri veriye erişemiyor. Gerçek auth'u kurduğunda bu
yeterlilik seviyesini yükseltirsin.

## 1) Yerel geliştirme (deploy etmeden önce test etmek için)

```bash
npm install
npm run dev
```

Terminalde iki link göreceksin:

```
Ezgi link:  http://localhost:3000/?u=dev-token-a
Aslı link:  http://localhost:3000/?u=dev-token-b
```

Bu modda veriler `.local-state.json` dosyasına yazılır (gerçek veritabanı
gerekmez) — sadece arayüzü/akışı test etmek için.

## 2) Gerçek paylaşım için deploy (Vercel)

### a) Vercel'e yükle

```bash
npm install -g vercel   # daha önce kurmadıysan
vercel                  # proje klasöründe çalıştır, sorulara varsayılan cevapları verebilirsin
```

Ya da bu klasörü bir GitHub reposuna atıp Vercel dashboard'undan "Import
Project" ile bağlayabilirsin — ikisi de çalışır.

### b) Veritabanını ekle (Upstash for Redis)

1. Vercel dashboard → projenin **Storage** sekmesi → **Marketplace Database
   Providers** → **Upstash for Redis** → projene bağla.
2. Bu işlem `KV_REST_API_URL` ve `KV_REST_API_TOKEN` ortam değişkenlerini
   projene otomatik olarak ekler — elle bir şey yapmana gerek yok.

### c) Erişim kodlarını oluştur

Terminalde iki uzun rastgele kod üret:

```bash
openssl rand -hex 24
openssl rand -hex 24
```

Vercel dashboard → **Settings → Environment Variables** kısmına ekle:

| Key | Value |
|---|---|
| `TOKEN_A` | (Ezgi için ürettiğin ilk kod) |
| `TOKEN_B` | (Aslı için ürettiğin ikinci kod) |

### d) Yeniden deploy et

Ortam değişkenlerini eklendikten sonra bir kere daha `vercel --prod` çalıştır
(ya da dashboard'dan "Redeploy" de) ki yeni değerleri alsın.

### e) Linkleri paylaş

Deploy tamamlanınca sana bir `https://....vercel.app` adresi verecek. Her
kişiye kendi linkini gönder:

```
Ezgi için:  https://<senin-domainin>/?u=<TOKEN_A>
Aslı için:  https://<senin-domainin>/?u=<TOKEN_B>
```

Bu linke bir kere girdiklerinde kod tarayıcılarında saklanır (localStorage),
bir daha kod girmeleri gerekmez — linki yer imlerine ekleyebilir ya da iPhone'da
"Ana Ekrana Ekle" ile normal bir uygulama gibi kullanabilirler.

**Önemli:** Bu linkleri birbirinizin dışında kimseyle paylaşmayın — linki bilen
herkes o kişi olarak veri girebilir (gerçek login olmadığı için).

## Gizlilik kuralı nasıl garanti ediliyor?

`lib/domain.js` içindeki `buildPartnerView()` fonksiyonu, karşı tarafa
gönderilecek veriyi oluşturan TEK yer. Bu fonksiyon partnerin gerçek kilosunu
(`setup.startWeight`, `setup.goalWeight`, `days[*].weight`) hiçbir zaman
okumuyor/döndürmüyor — sadece önceden hesaplanmış "değişim" sayılarını
(`totalChange`, `changeSeries`) gönderiyor. `api/state.js` ve `api/action.js`
her zaman bu fonksiyondan geçiyor, yani istemci tarafında bir hata olsa bile
gerçek kilo ağa hiç çıkmıyor.

## Sonraki adımlar (auth/backend'i büyütmek istersen)

- `lib/kv.js` → `resolveRole()`: token kontrolünü gerçek bir session/JWT
  kontrolüyle değiştir.
- Şu an tek bir "state" objesi tek anahtar altında tutuluyor (iki kişilik
  kullanım için yeterli). Daha fazla kişi/çift eklemek istersen, `STATE_KEY`'i
  sabit yerine bir "household id"ye göre üretmen yeterli.
- Eşzamanlı yazmalarda "son yazan kazanır" mantığı var — iki kişilik günlük
  kullanım için sorun çıkarmaz, ama kritik olursa `lib/kv.js`'e basit bir
  optimistic-lock eklenebilir.
