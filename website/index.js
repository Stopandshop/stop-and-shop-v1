
// 1. إعدادات Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCLBuU3lpqpNKiQvH5hDoQAYtdzePUsxp8",
    authDomain: "stopandshop-157ff.firebaseapp.com",
    projectId: "stopandshop-157ff",
    storageBucket: "stopandshop-157ff.firebasestorage.app",
    messagingSenderId: "622958508953",
    appId: "1:622958508953:web:8f2b8f60f1d4e323353108"
};

// التأكد من تهيئة Firebase مرة واحدة فقط
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// 2. المتغيرات العامة
const exchangeRate = 89000;
let isAdmin = false;
let cart = [];
let products = []; 

// 3. دوال التشغيل والتحميل
window.addEventListener('load', () => {
    loadProducts();      // جلب المنتجات
    loadSavedCart();     // استرجاع السلة
    checkFirstVisit();   // فحص الترحيب
});

// --- وظائف النافذة والترحيب ---
function toggleCartPopup() {
    const popup = document.getElementById('cart-popup');
    if (!popup) return;
    popup.style.display = (popup.style.display === 'none' || popup.style.display === '') ? 'block' : 'none';
    if (popup.style.display === 'block') renderCartItems();
}

function checkFirstVisit() {
    const welcomeModal = document.getElementById('welcome-modal');
    if (!welcomeModal) return;
    if (!localStorage.getItem('visited_stop_shop')) {
        welcomeModal.style.display = 'flex';
    }
}

function closeWelcome() {
    document.getElementById('welcome-modal').style.display = 'none';
    localStorage.setItem('visited_stop_shop', 'true');
}

// 4. دوال Firebase والبيانات
function loadProducts() {
    db.collection("products").onSnapshot((snapshot) => {
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (isAdmin) updateDashboardStats(); // تحديث الأرقام إذا كان المسؤول داخلاً
        displayProducts(products);
    });
}

// 5. دوال العرض والبحث (الإصلاح الجوهري هنا)
function displayProducts(productsList) {
    const container = document.getElementById('products-container');
    if (!container) return;
    container.innerHTML = ""; 

    productsList.forEach(product => {
        const priceLBP = (parseFloat(product.price) || 0) * exchangeRate;
        
        // أزرار الإدارة تظهر فقط للمسؤول
        let adminButtons = "";
        if (isAdmin) {
            adminButtons = `
                <div class="admin-actions">
                    <button class="edit-btn" onclick="editProduct('${product.id}')"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="delete-btn" onclick="deleteProduct('${product.id}')"><i class="fas fa-trash"></i> حذف</button>
                </div>`;
        }

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image}" onerror="this.src='https://via.placeholder.com/150'">
            ${adminButtons} 
            <h3>${product.name}</h3>
            <div class="price-container">
                <p class="price-usd">$${parseFloat(product.price).toFixed(2)}</p>
                <p class="price-lbp">${priceLBP.toLocaleString()} ل.ل</p>
            </div>
            <button class="add-btn" onclick="addToCart('${product.id}')">
                <i class="fas fa-cart-plus"></i> أضف للسلة
            </button>
        `;
        container.appendChild(card);
    });
}

function searchProducts() {
    const term = document.getElementById('search-input').value.toLowerCase().trim();
    
    // البحث في كل المنتجات الأصلية
    const filtered = products.filter(p => {
        const name = (p.name || "").toLowerCase();
        const cat = (p.category || "").toLowerCase();
        return name.includes(term) || cat.includes(term);
    });

    displayProducts(filtered);
}

function filterByCategory(category, btn) {
    if(btn) {
        document.querySelectorAll('.categories button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    const cleanCategory = category.trim();
    const filtered = (cleanCategory === 'الكل') ? products : products.filter(p => p.category.trim() === cleanCategory);
    displayProducts(filtered);
}

// 6. نظام السلة
function addToCart(productId) {
    // 1. البحث عن المنتج في القائمة الكبيرة
    const product = products.find(p => p.id === productId);
    
    if (product) {
        // 2. التأكد من أن السلة مصفوفة
        if (!Array.isArray(cart)) cart = [];

        // 3. البحث إذا كان المنتج موجوداً مسبقاً في السلة
        const existingItem = cart.find(item => item.id === productId);

        if (existingItem) {
            existingItem.quantity += 1; // زيادة الكمية فقط
        } else {
            // إضافة المنتج لأول مرة مع خاصية الكمية
            cart.push({ ...product, quantity: 1 });
        }

        // 4. تحديث الواجهة والبيانات
        updateCartCount();
        saveCartToStorage();
        renderCartItems(); // تحديث شكل السلة فوراً
        checkCartMilestone(); // تحديث شريط التقدم 50$

        // 5. تأثير حركي (أنيميشن)
        const icon = document.querySelector('.cart-info');
        if(icon) {
            icon.classList.add('shake-animation');
            setTimeout(() => icon.classList.remove('shake-animation'), 300);
        }
    } else {
        console.error("المنتج غير موجود في القائمة!");
    }
}
function updateCartCount() {
    const countElem = document.getElementById('cart-count');
    if (countElem) {
        // حساب مجموع الكميات (مثلاً: 2 لبنة + 1 حليب = 3 قطع)
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        countElem.innerText = totalItems;
    }
}

function renderCartItems() {
    const list = document.getElementById('cart-items-list');
    if (!list) return;
    list.innerHTML = "";
    let totalUsd = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        totalUsd += itemTotal;
        list.innerHTML += `
            <div class="cart-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                <div style="flex: 2;">
                    <span style="font-weight: bold;">${item.name}</span>
                    <div style="font-size: 0.8rem; color: #666;">$${item.price.toFixed(2)} × ${item.quantity}</div>
                </div>
                <span style="flex: 1; text-align: center; font-weight: bold; color: #c0392b;">$${itemTotal.toFixed(2)}</span>
                <button onclick="removeFromCart(${index})" style="color:red; border:none; background:none; cursor:pointer; font-size: 1.2rem;">×</button>
            </div>`;
    });
    
    document.getElementById('total-usd').innerText = totalUsd.toFixed(2);
    document.getElementById('total-lbp').innerText = (totalUsd * exchangeRate).toLocaleString();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartCount();
    renderCartItems();
    saveCartToStorage();
}

function saveCartToStorage() {
    localStorage.setItem('stop_shop_cart', JSON.stringify(cart));
}
function loadSavedCart() {
    const saved = localStorage.getItem('stop_shop_cart');
    if (saved) {
        try {
            cart = JSON.parse(saved);
            cart.forEach(item => {
                if (!item.quantity) item.quantity = 1;
            });
            updateCartCount();
            // إضافة السطرين التاليين لضمان تحديث الواجهة فوراً
            renderCartItems(); 
            checkCartMilestone(); 
        } catch (e) {
            cart = [];
        }
    }
}

function clearCart() {
    if(confirm("تفريغ السلة؟")) {
        cart = [];
        updateCartCount();
        renderCartItems();
        localStorage.removeItem('stop_shop_cart');
    }
}
async function checkout() {
    if (cart.length === 0) return;

    const totalUsd = parseFloat(document.getElementById('total-usd').innerText);
    const payment = document.getElementById('payment-choice').value;
    
    // تعريف المتغيرات المطلوبة للرسالة وقاعدة البيانات
    const orderId = "SS" + Date.now().toString().slice(-6);
    const pointsEarned = Math.floor(totalUsd / 5); // حساب النقاط منفصل

    try {
        // حفظ الطلب في Firebase - المال في حقل والنقاط في حقل آخر
        await db.collection("orders").add({
            orderId: orderId,
            total: totalUsd,      // مبيعات مالية (تظهر في لوحة التحكم)
            totalPrice: totalUsd, // حقل إضافي ليتوافق مع كود جدول المسؤول السابق
            items: cart,          // سطر إضافي: حفظ المنتجات لكي تظهر عند الطباعة
            points: pointsEarned, // نقاط (منفصلة تماماً)
            date: firebase.firestore.FieldValue.serverTimestamp(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(), // سطر إضافي: للترتيب الزمني في الجدول
            payment: payment
        });

       // داخل دالة checkout المستبدلة سابقاً
const trackingLink = `https://wa.me/96181479786?text=${encodeURIComponent("مرحباً، أود تتبع حالة طلبي رقم: #" + orderId)}`;

let msg = `🛒 *طلب جديد من Stop & Shop*\n`;
msg += `🔖 *رقم الطلب:* #${orderId}\n`;
msg += `--------------------------\n`;
cart.forEach((item, i) => {
    msg += `${i + 1}- ${item.name} (الكمية: ${item.quantity})\n`;
});
msg += `--------------------------\n`;
msg += `💰 *الإجمالي:* $${totalUsd}\n`;
msg += `💳 *الدفع:* ${payment}\n`;
msg += `✨ *نقاطك:* ${pointsEarned} نقطة\n\n`;
msg += `📍 *لتتبع حالة طلبك اضغط هنا:*\n${trackingLink}`; // إضافة رابط التتبع

// الحل النهائي: التحقق إذا كان المستخدم على هاتف أم كمبيوتر
const finalUrl = `https://wa.me/96181479786?text=${encodeURIComponent(msg)}`;

if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    // للهاتف: الانتقال المباشر لضمان فتح التطبيق وتجنب الحظر
    window.location.assign(finalUrl);
} else {
    // للكمبيوتر: فتح نافذة جديدة كما كنت تفعل سابقاً
    window.open(finalUrl, '_blank');
}
        // تفريغ السلة بعد نجاح الحفظ
        cart = [];
        updateCartCount();
        renderCartItems();
        localStorage.removeItem('stop_shop_cart');
        alert("تم إرسال طلبك بنجاح!");

    } catch (e) {
        console.error("Firebase Error:", e);
        // ستظهر لك الرسالة هنا إذا كانت القواعد (Rules) لا تزال مغلقة
        alert("فشل في حفظ الطلب: " + e.message);
    }
}

// --- 2. عداد مبيعات اليوم (لوحة التحكم) - يقرأ 'total' المالي فقط ---
function loadSalesStats() {
    const todayStr = new Date().toLocaleDateString('en-CA'); 

    db.collection("orders").onSnapshot((snapshot) => {
        let dailyMoneyTotal = 0; 
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.date && data.total) {
                const orderDate = data.date.toDate().toLocaleDateString('en-CA');
                if (orderDate === todayStr) {
                    dailyMoneyTotal += parseFloat(data.total); // يجمع المبالغ المالية فقط
                }
            }
        });
        
        const salesElem = document.getElementById('stat-total-sales');
        if (salesElem) {
            salesElem.innerText = "$ " + dailyMoneyTotal.toFixed(2);
            
            // تأثير وميض خفيف للتأكيد على التحديث
            const card = document.getElementById('sales-card');
            if (card) {
                card.style.transform = "scale(1.05)";
                setTimeout(() => { card.style.transform = "scale(1)"; }, 300);
            }
        }
    });
}

// --- 3. شريط التقدم (Progress Bar) - يعتمد على سلة المشتريات الحالية فقط ---
function checkCartMilestone() {
    const totalUsd = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressHint = document.getElementById('progress-hint');
    const container = document.getElementById('progress-container');

    if (totalUsd > 0) {
        if (container) container.style.display = 'block';
        let percentage = Math.min((totalUsd / 50) * 100, 100);
        
        if (progressBar) progressBar.style.width = percentage + "%";
        if (progressText) progressText.innerText = Math.floor(percentage) + "%";

        if (totalUsd < 50) {
            const remaining = (50 - totalUsd).toFixed(2);
            if (progressHint) progressHint.innerHTML = `🛍️ باقي لك <span style="color:#c0392b">$${remaining}</span> لتصبح زبوناً مميزاً!`;
            if (progressBar) progressBar.style.background = "linear-gradient(90deg, #c0392b, #e74c3c)";
            
            // إعادة ضبط الحالة إذا نقص المبلغ عن 50$ (حذف منتج مثلاً)
            sessionStorage.removeItem('celebrated');
        } else {
            if (progressHint) progressHint.innerHTML = "🎊 مبروك! لقد وصلت لهدف التميز في Stop & Shop";
            if (progressBar) progressBar.style.background = "linear-gradient(90deg, #27ae60, #2ecc71)";

            // إطلاق الاحتفال إذا لم يتم الاحتفال بعد في هذه الجلسة
            if (!sessionStorage.getItem('celebrated')) {
                launchConfetti();
                sessionStorage.setItem('celebrated', 'true');
            }
        }
    } else {
        if (container) container.style.display = 'none';
    }
}

// دالة إطلاق القصاصات الورقية
function launchConfetti() {
    var duration = 3 * 1000;
    var end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#c0392b', '#ffffff', '#27ae60'] // ألوان المحل (أحمر، أبيض، أخضر)
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#c0392b', '#ffffff', '#27ae60']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}
// 7. إدارة المسؤول (Firebase CRUD)
async function saveProduct() {
    const id = document.getElementById('edit-product-id').value;
    const name = document.getElementById('new-name').value;
    const price = parseFloat(document.getElementById('new-price').value);
    const category = document.getElementById('new-category').value;
    const image = document.getElementById('new-image').value;

    if (!name || isNaN(price) || !image) return alert("أكمل البيانات!");

    const data = { name, price, category, image };
    try {
        if (id) {
            await db.collection("products").doc(id).update(data);
            alert("تم التعديل!");
        } else {
            await db.collection("products").add(data);
            alert("تمت الإضافة!");
        }
        resetForm();
    } catch (e) { alert("خطأ في Firebase: " + e.message); }
    
}

function toggleAdmin() {
    const loginBtn = document.getElementById('login-btn');
    const dashboard = document.getElementById('admin-dashboard');
    
    if (isAdmin) {
        isAdmin = false;
        document.getElementById('add-product-form').style.display = 'none';
        dashboard.style.display = 'none'; 
        loginBtn.innerHTML = '<i class="fas fa-user"></i> دخول';
        displayProducts(products);
        return;
    }

    const password = prompt("أدخل كلمة مرور المسؤول:");
    if (password === "bassam1632004") {
        isAdmin = true;
        document.getElementById('add-product-form').style.display = 'block';
        dashboard.style.display = 'block'; 
        loginBtn.innerHTML = '<i class="fas fa-user-shield"></i> خروج';
        
        // استدعاء الدوال بالترتيب الصحيح لضمان تحديث الأرقام
        loadSalesStats(); 
        updateDashboardStats();
        displayProducts(products); 
    } else {
        alert("كلمة المرور خاطئة!");
    }
}
function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    document.getElementById('edit-product-id').value = product.id;
    document.getElementById('new-name').value = product.name;
    document.getElementById('new-price').value = product.price;
    document.getElementById('new-category').value = product.category;
    document.getElementById('new-image').value = product.image;
    document.getElementById('form-title').innerText = "تعديل: " + product.name;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteProduct(id) {
    if (confirm("حذف المنتج نهائياً؟")) {
        await db.collection("products").doc(id).delete();
    }
}

function resetForm() {
    document.getElementById('edit-product-id').value = "";
    document.getElementById('new-name').value = "";
    document.getElementById('new-price').value = "";
    document.getElementById('new-image').value = "";
    document.getElementById('form-title').innerText = "إضافة منتج جديد";
}

// 8. الطباعة والعودة للأعلى
function printInvoice() {
    if (cart.length === 0) return alert("السلة فارغة، لا يوجد ما يمكن طباعته!");

    const totalUsd = document.getElementById('total-usd').innerText;
    const totalLbp = document.getElementById('total-lbp').innerText;
    const paymentMethod = document.getElementById('payment-choice').value;
    const date = new Date().toLocaleString('ar-LB');
    const points = Math.floor(parseFloat(totalUsd) / 5); // نظام النقاط الخاص بك

    let invoiceContent = `
        <div dir="rtl" style="font-family: 'Tajawal', sans-serif; padding: 30px; border: 1px solid #eee; width: 380px; margin: auto; color: #333; background: #fff;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="margin: 0; color: #c0392b; font-size: 28px; letter-spacing: 1px;">Stop & Shop</h1>
                <p style="margin: 5px 0; font-size: 14px; color: #7f8c8d;">ميني ماركت - تجربة تسوق ذكية</p>
                <div style="height: 2px; background: linear-gradient(to left, #c0392b, #000); margin-top: 10px;"></div>
            </div>

            <div style="font-size: 13px; margin-bottom: 20px; line-height: 1.6;">
                <p><b>رقم الطلب:</b> #SS${Date.now().toString().slice(-6)}</p>
                <p><b>التاريخ:</b> ${date}</p>
                <p><b>طريقة الدفع:</b> <span style="background: #f4f4f4; padding: 2px 8px; border-radius: 4px;">${paymentMethod}</span></p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background: #f9f9f9; border-bottom: 2px solid #333;">
                        <th style="text-align: right; padding: 10px; font-size: 14px;">المنتج</th>
                        <th style="text-align: center; padding: 10px; font-size: 14px;">الكمية</th>
                        <th style="text-align: left; padding: 10px; font-size: 14px;">المجموع</th>
                    </tr>
                </thead>
                <tbody>
    `;

    cart.forEach(item => {
        invoiceContent += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-size: 14px;">${item.name}</td>
                <td style="text-align: center; padding: 10px 0;">${item.quantity}</td>
                <td style="text-align: left; padding: 10px 0; font-weight: bold;">$${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `;
    });

    invoiceContent += `
                </tbody>
            </table>

           <div style="margin-top: 25px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
                <p style="margin: 5px 0; font-size: 14px;">
                    <i class="fab fa-whatsapp" style="color: #25D366;"></i> 
                    <b>للتواصل والطلب:</b> 9618147986+
                </p>
                <p style="margin: 5px 0; font-size: 12px; color: #7f8c8d;">
                    <i class="fas fa-map-marker-alt" style="color: #c0392b;"></i>
                    مؤسسة نصور التجارية - ميني ماركت Stop & Shop
                </p>
                
                <div style="margin-top: 15px; opacity: 0.8;">
                    <small style="display: block; margin-bottom: 5px; color: #95a5a6;">مسح للطلب السريع</small>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://wa.me/96181479786" alt="QR Code" style="width: 70px; height: 70px;">
                </div>
            </div>

            <p style="text-align: center; margin-top: 20px; font-size: 11px; color: #bdc3c7; font-style: italic;">
                شكراً لثقتكم بمؤسستنا، نتشرف بخدمتكم دائماً.
            </p>
        </div>
    `;

    // فتح نافذة الطباعة
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>فاتورة Stop & Shop</title>
                <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    body { margin: 0; padding: 20px; background: #f0f0f0; }
                    @media print {
                        body { background: white; padding: 0; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                ${invoiceContent}
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

window.onscroll = function() {
    const btn = document.getElementById("backToTop");
    if (btn) btn.style.display = (window.scrollY > 300) ? "flex" : "none";
};

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCelebrationNotify() {
    // إنشاء عنصر الإشعار برمجياً
    const notify = document.createElement('div');
    notify.className = 'milestone-notify';
    notify.innerHTML = `
        <div style="background: #27ae60; color: white; padding: 20px; border-radius: 15px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2); position: fixed; top: 20%; left: 50%; transform: translateX(-50%); z-index: 10000; min-width: 280px; animation: slideDown 0.5s ease;">
            <i class="fas fa-crown" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
            <h3 style="margin: 0;">تهانينا! 🎉</h3>
            <p style="margin: 10px 0 0;">لقد تخطيت مبلغ 50$ في طلبك!</p>
            <p style="font-size: 0.8rem; opacity: 0.9;">شكراً لثقتك بـ Stop & Shop</p>
            <button onclick="this.parentElement.remove()" style="margin-top: 15px; background: white; color: #27ae60; border: none; padding: 5px 15px; border-radius: 20px; cursor: pointer; font-weight: bold;">حسناً</button>
        </div>
    `;
    document.body.appendChild(notify);
    
    
    // إخفاء تلقائي بعد 5 ثوانٍ
    setTimeout(() => { if(notify) notify.remove(); }, 5000);
}
function updateDashboardStats() {
    const totalProducts = products.length;
    const categories = [...new Set(products.map(p => p.category))].length;

    document.getElementById('stat-total-products').innerText = totalProducts;
    document.getElementById('stat-total-categories').innerText = categories;
}
window.addEventListener('load', () => {
    loadProducts();      
    loadSavedCart();     
    checkFirstVisit();   
    loadSalesStats(); // أضف هذا السطر هنا
});
// دالة إغلاق رسالة الترحيب
function closeWelcome() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}
window.addEventListener('load', () => {
    // إذا لم يسبق للزبون رؤية الرسالة في هذه الجلسة
    if (!sessionStorage.getItem('welcomeShown')) {
        document.getElementById('welcome-modal').style.display = 'flex';
        sessionStorage.setItem('welcomeShown', 'true');
    } else {
        document.getElementById('welcome-modal').style.display = 'none';
    }
});
// 1. دالة لجلب البيانات من Firebase وعرضها في الجدول
function loadSalesHistory() {
    const list = document.getElementById('admin-orders-list');
    if (!list) return;

    // جلب آخر 15 طلب من Firebase
    db.collection("orders").orderBy("timestamp", "desc").limit(15).get().then((querySnapshot) => {
        list.innerHTML = ""; 
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // إنشاء صف لكل فاتورة مع زر طباعة
            const row = document.createElement('tr');
            row.style.borderBottom = "1px solid #455a64";
            row.innerHTML = `
                <td style="padding: 10px;">#${data.orderId || '---'}</td>
                <td style="padding: 10px; font-weight: bold; color: #2ecc71;">$${data.totalPrice || 0}</td>
                <td style="padding: 10px;">
                    <button onclick='printArchiveOrder(${JSON.stringify(data)})' 
                            style="background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-print"></i> طباعة
                    </button>
                </td>
            `;
            list.appendChild(row);
        });
    }).catch(err => console.error("Error loading orders:", err));
}

// 2. دالة وسيطة للطباعة (تستخدم دالتك الأصلية printInvoice)
function printArchiveOrder(orderData) {
    // حفظ السلة الحالية للزبون مؤقتاً لكي لا تضيع
    const tempCart = [...cart]; 
    
    // استبدال السلة ببيانات الفاتورة القديمة ليقرأها كود الطباعة الخاص بك
    cart = orderData.items; 
    
    // استدعاء دالة الطباعة الخاصة بك الموجودة في الكود
    printInvoice(); 
    
    // إعادة سلة الزبون الحالية كما كانت
    cart = tempCart;
}

// 3. تحديث الجدول تلقائياً عند فتح لوحة التحكم
// سنقوم بتعديل دالة toggleAdmin لتشغيل التحديث
const oldToggleAdmin = toggleAdmin;
toggleAdmin = function() {
    oldToggleAdmin(); // تشغيل الكود الأصلي الخاص بك
    const adminPanel = document.getElementById('admin-dashboard');
    if (adminPanel.style.display !== 'none') {
        loadSalesHistory(); // تحديث القائمة فور فتح اللوحة
    }
};