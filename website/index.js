window.onload = function() {
    updateShopStatus(); 
    renderCartItems();  
};
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
let exchangeRate = parseFloat(localStorage.getItem('exchangeRate')) || 90000; 
let isAdmin = false;
let cart = [];
let products = [];; 

// 3. دوال التشغيل والتحميل
window.addEventListener('load', () => {
    loadProducts();      // جلب المنتجات
    loadSavedCart();     // استرجاع السلة
    checkFirstVisit();   // فحص الترحيب
});
async function syncExchangeRate() {
    const rateDoc = await db.collection("settings").doc("exchange_rate").get();
    if (rateDoc.exists) {
        exchangeRate = rateDoc.data().value;
        localStorage.setItem('exchangeRate', exchangeRate);
    }
}
syncExchangeRate();

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

function loadProducts() {
    const loadingArea = document.getElementById('loading-area');
    const loadingText = document.getElementById('loading-text');

    // 1. البداية
    if (loadingArea) loadingArea.style.display = 'block';
    if (loadingText) loadingText.innerText = "🔍عم نجبلك البضاعة...    ";
    showProgress(20);

    db.collection("products").onSnapshot((snapshot) => {
        // 2. معالجة البيانات
        if (loadingText) loadingText.innerText = "⚙️ يتم الآن ترتيب المنتجات...";
        showProgress(70);

        let allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        products = allProducts.sort((a, b) => {
            const dateA = a.createdAt || 0;
            const dateB = b.createdAt || 0;
            return dateB - dateA; 
        });

        // 3. الانتهاء
        if (loadingText) loadingText.innerText = "✅ اكتمل التحميل!";
        showProgress(100);

        if (isAdmin) updateDashboardStats(); 
        displayProducts(products);

        // إخفاء منطقة التحميل بعد ثانية واحدة من الاكتمال
        setTimeout(() => {
            if (loadingArea) loadingArea.style.display = 'none';
        }, 1500);
        // أضف هذا السطر داخل الـ Snapshot
updateOffersBanner(products);
displayProducts(products);
        
    }, (error) => {
        if (loadingText) loadingText.innerText = "❌ فشل التحميل، يرجى المحاولة لاحقاً";
        console.error(error);
    });
}
// 5. دوال العرض والبحث (الإصلاح الجوهري هنا)
function displayProducts(productsList) {
    const container = document.getElementById('products-container');
    if (!container) return;
    container.innerHTML = ""; 

    productsList.forEach(product => {
        const priceLBP = (parseFloat(product.price) || 0) * exchangeRate;
        
        // --- منطق الملصقات والمخزن ---
        const now = Date.now();
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        const isNew = product.createdAt && (now - product.createdAt) < threeDays;
        
        // --- الإضافة الجديدة: فحص هل يوجد عرض (Offer) ---
        const hasOffer = product.oldPrice && parseFloat(product.oldPrice) > parseFloat(product.price);
        
        let badgeHTML = "";
        let outOfStockClass = "";

        // ملاحظة لـ Stop & Shop: نعتمد هنا على "isOutOfStock" التي يتم تحديثها تلقائياً
        if (product.isOutOfStock) {
            badgeHTML = `<span class="product-badge badge-out">نفذ من المخزن</span>`;
            outOfStockClass = "out-of-stock";
        } else if (hasOffer) {
            // إذا كان هناك عرض، تظهر علامة "عرض خاص"
            badgeHTML = `<span class="product-badge" style="background:#e74c3c; color:white;">عرض خاص</span>`;
        } else if (isNew) {
            badgeHTML = `<span class="product-badge badge-new">جديد</span>`;
        }

        let adminButtons = "";
        if (isAdmin) {
            adminButtons = `
                <div class="admin-actions">
                    <button class="edit-btn" onclick="editProduct('${product.id}')"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="delete-btn" onclick="deleteProduct('${product.id}')"><i class="fas fa-trash"></i> حذف</button>
                </div>`;
        }

        // --- تعديل: إظهار نص الكمية فقط للمسؤول (Admin) ---
        let stockInfoHTML = "";
        if (isAdmin) {
            stockInfoHTML = `<p style="font-size: 0.7rem; color: ${product.stock < 10 ? 'red' : '#27ae60'}; margin: 5px 0;">
                المتوفر: ${product.stock} قطعة (Admin view)
            </p>`;
        }
        // ---------------------------------------------------

        let quantityHTML = "";
        if (!product.isOutOfStock) {
            quantityHTML = `
            <div class="quantity-control" style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px;">
                <button onclick="updateQty('${product.id}', -1)" style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid #ddd; background: #f8f9fa; cursor:pointer;">-</button>
                <input type="number" id="qty-${product.id}" value="1" min="1" readonly style="width: 40px; text-align: center; border: 1px solid #ddd; border-radius: 5px; font-weight: bold; background: transparent;">
                <button onclick="updateQty('${product.id}', 1)" style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid #ddd; background: #f8f9fa; cursor:pointer;">+</button>
            </div>`;
        }

        const card = document.createElement('div');
        card.className = `product-card ${outOfStockClass}`;
        card.innerHTML = `
            ${badgeHTML} <img src="${product.image}" onerror="this.src='https://via.placeholder.com/150'">
            ${adminButtons} 
            <h3>${product.name}</h3>
            <div class="price-container">
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <p class="price-usd" style="margin:0;">$${parseFloat(product.price).toFixed(2)}</p>
                    ${hasOffer ? `<p style="text-decoration: line-through; color: #e74c3c; font-size: 0.8rem; margin:0;">$${parseFloat(product.oldPrice).toFixed(2)}</p>` : ''}
                </div>
                <p class="price-lbp">${priceLBP.toLocaleString()} ل.ل</p>
            </div>
            
            ${stockInfoHTML} ${quantityHTML}

            <button class="add-btn" onclick="addToCart('${product.id}')" ${product.isOutOfStock ? 'disabled style="background:#888"' : ''}>
                <i class="fas fa-cart-plus"></i> ${product.isOutOfStock ? 'غير متوفر' : 'أضف للسلة'}
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
        
        // --- الإضافة الجديدة للباركود دون حذف القديم ---
        const barcode = (p.barcode || "").toLowerCase(); 
        
        // تعديل سطر الـ return ليشمل مطابقة الباركود أيضاً
        return name.includes(term) || cat.includes(term) || barcode === term;
    });

    displayProducts(filtered);
}

function filterByCategory(category, btn) {
    if(btn) {
        document.querySelectorAll('.categories button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    
    const cleanCategory = category.trim();
    
    // تعديل السطر ليكون أكثر مرونة في البحث
    const filtered = (cleanCategory === 'الكل') 
        ? products 
        : products.filter(p => p.category && p.category.toString().includes(cleanCategory));
        
    displayProducts(filtered);
}

/// 6. نظام السلة
async function addToCart(productId) {
    // --- إضافة السطر التالي لجلب الكمية المختارة من الواجهة ---
    const qtyInput = document.getElementById(`qty-${productId}`);
    const chosenQuantity = qtyInput ? parseInt(qtyInput.value) : 1;

    // --- [تعديل ذكي للباركود]: البحث عن المنتج سواء أرسلنا ID أو باركود ---
    let product = products.find(p => p.id === productId || p.barcode === productId);
    
    if (product) {
        // تحديث الـ productId الحقيقي في حال تم العثور عليه عن طريق الباركود لضمان عمل العمليات التالية
        const realProductId = product.id;

        // 1. البحث عن المنتج في القائمة الكبيرة (موجود مسبقاً في السطر أعلاه)
        
        if (product) {
            // --- فحص المخزن قبل الإضافة ---
            if (product.stock !== undefined && product.stock < chosenQuantity) {
                alert(`عذراً، المتوفر في المخزن هو ${product.stock} فقط!`);
                return;
            }

            // 2. التأكد من أن السلة مصفوفة
            if (!Array.isArray(cart)) cart = [];

            // 3. البحث إذا كان المنتج موجوداً مسبقاً في السلة
            const existingItem = cart.find(item => item.id === realProductId);

            if (existingItem) {
                // --- تعديل السطر التالي ليضيف الكمية المختارة بدلاً من 1 فقط ---
                existingItem.quantity += chosenQuantity; 
            } else {
                // إضافة المنتج لأول مرة مع خاصية الكمية
                // --- تعديل السطر التالي ليأخذ الكمية المختارة ---
                cart.push({ ...product, quantity: chosenQuantity });
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

            // --- إضافة سطر لإعادة تصفير العداد إلى 1 بعد الإضافة بنجاح ---
            if(qtyInput) qtyInput.value = 1;

            // --- تحديث المخزن في Firebase عند الإضافة الناجحة ---
            try {
                const newStock = product.stock - chosenQuantity;
                await db.collection("products").doc(realProductId).update({
                    stock: newStock,
                    isOutOfStock: newStock <= 0
                });
                // تحديث القائمة المحلية لضمان مزامنة البيانات دون إعادة تحميل الصفحة
                product.stock = newStock;
                if (newStock <= 0) product.isOutOfStock = true;
            } catch (error) {
                console.error("خطأ في تحديث المخزن:", error);
            }

        }
    } else {
        console.error("المنتج غير موجود في القائمة!");
    }
    updateRewardProgress();
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

    // --- إضافة: التحقق من وجود طلب سابق لإظهار زر الإعادة إذا كانت السلة فارغة ---
    if (cart.length === 0) {
        const lastOrder = localStorage.getItem('last_order');
        if (lastOrder) {
            list.innerHTML = `
                <div id="reorder-container" style="padding: 20px; text-align: center; background: #fff9f0; border-radius: 10px; margin: 10px;">
                    <p style="font-size: 0.9rem; color: #666; margin-bottom: 10px;">هل تود إضافة منتجات آخر طلب قمت به؟</p>
                    <button onclick="repeatLastOrder()" style="background-color: #f39c12; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>🔄</span> إعادة طلب سابق
                    </button>
                </div>`;
        }
    }
    // -----------------------------------------------------------------------

    cart.forEach((item, index) => {
        // حساب إجمالي السعر بناءً على الكمية المختارة
        const itemTotal = item.price * (item.quantity || 1); 
        totalUsd += itemTotal;

        list.innerHTML += `
            <div class="cart-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                <div style="flex: 2;">
                    <span style="font-weight: bold;">${item.name}</span>
                    <div style="font-size: 0.8rem; color: #666;">
                        $${item.price.toFixed(2)} × ${item.quantity || 1}
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 5px; margin: 0 10px;">
                    <button onclick="changeQuantity(${index}, 1)" style="width:25px; height:25px; border-radius:50%; border:1px solid #ddd; background:white; cursor:pointer;">+</button>
                    <span style="min-width: 20px; text-align: center; font-weight: bold;">${item.quantity || 1}</span>
                    <button onclick="changeQuantity(${index}, -1)" style="width:25px; height:25px; border-radius:50%; border:1px solid #ddd; background:white; cursor:pointer;">-</button>
                </div>

                <div style="flex: 1; display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-weight: bold; color: #c0392b;">$${itemTotal.toFixed(2)}</span>
                    <button onclick="removeFromCart(${index})" style="color:red; border:none; background:none; cursor:pointer; font-size: 1.2rem; margin-right: 10px;">×</button>
                </div>
            </div>`;
    });
    
    // تحديث المجموع النهائي بالدولار والليرة اللبنانية
    const totalUsdElement = document.getElementById('total-usd');
    const totalLbpElement = document.getElementById('total-lbp');
    
    if (totalUsdElement) totalUsdElement.innerText = totalUsd.toFixed(2);
    if (totalLbpElement) totalLbpElement.innerText = (totalUsd * exchangeRate).toLocaleString();
    
    // تحديث شريط التقدم للحصول على التوصيل المجاني
    updateRewardProgress();
}

// أضف هذه الدالة تحت دالة renderCartItems لكي تعمل الأزرار
function changeQuantity(index, delta) {
    if (cart[index].quantity + delta > 0) {
        cart[index].quantity += delta;
    } else {
        // إذا نقصت الكمية عن 1 يتم حذف المنتج
        removeFromCart(index);
        return; 
    }
    // حفظ التعديل وتحديث الواجهة
    if (typeof saveCart === "function") saveCart(); 
    renderCartItems();
    if (typeof updateCartCount === "function") updateCartCount();
}
async function removeFromCart(index) {
    // 1. الحصول على بيانات المنتج المراد حذفه من السلة
    const itemToRemove = cart[index];

    if (itemToRemove) {
        try {
            const db = firebase.firestore();
            
            // 2. تحديث المخزن في Firebase (الزيادة الحقيقية في السيرفر)
            // بما أنك تستخدم onSnapshot، فإن Firebase سيرسل التحديث الجديد للمصفوفة تلقائياً
            await db.collection("products").doc(itemToRemove.id).update({
                stock: firebase.firestore.FieldValue.increment(itemToRemove.quantity),
                isOutOfStock: false
            });

            // 3. تحديث مصفوفة المنتجات المحلية (products)
            // ملاحظة: قمنا بتعطيل العملية الحسابية هنا لأن onSnapshot سيقوم بجلب القيمة الصحيحة فوراً من Firebase
            const localProduct = products.find(p => p.id === itemToRemove.id);
            if (localProduct) {
                // نترك القيمة ليتم تحديثها عبر onSnapshot لضمان عدم التكرار (4 بدلاً من 2)
                localProduct.isOutOfStock = false;
            }

            // 4. حذف المنتج من مصفوفة السلة (كودك الأصلي)
            cart.splice(index, 1);

            // 5. تحديث الواجهة والبيانات (أكوادك الأصلية)
            saveCartToStorage();
            updateCartCount();
            renderCartItems();
            updateRewardProgress();
            
            // 6. تحديث عرض المنتجات (UI) ليعكس الكمية الصحيحة
            // في حالة onSnapshot، الواجهة ستتحدث تلقائياً، ولكن استدعاءها هنا يضمن السلاسة
            displayProducts(products); 

            console.log("تمت إعادة الكمية بدقة: تم استرجاع " + itemToRemove.quantity);

        } catch (error) {
            console.error("خطأ أثناء الحذف:", error);
        }
    }
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
            updateRewardProgress();
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
// دالة لجلب نقاط الزبون بناءً على رقم الهاتف
async function getCustomerPoints(phone) {
    const userDoc = await db.collection("users").doc(phone).get();
    if (userDoc.exists) {
        return userDoc.data().points || 0;
    }
    return 0;
}

// دالة لتحديث أو إنشاء نقاط الزبون
async function updateCustomerPoints(phone, newPoints) {
    const userRef = db.collection("users").doc(phone);
    const doc = await userRef.get();

    // إضافة: التأكد من أن النقاط رقم صحيح لتجنب أخطاء Firebase
    const pointsToAdd = parseInt(newPoints) || 0;

    if (doc.exists) {
        // إضافة النقاط الجديدة للموجود سابقاً
        await userRef.update({
            points: firebase.firestore.FieldValue.increment(pointsToAdd),
            lastOrder: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ تم تحديث نقاط الزبون ${phone}`);
    } else {
        // إنشاء سجل جديد للزبون لأول مرة
        await userRef.set({
            phone: phone,
            points: pointsToAdd,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✨ تم إنشاء سجل جديد لنقاط الزبون ${phone}`);
    }
}
// متغير عالمي لحفظ رابط الواتساب واستخدامه لاحقاً
window.currentWhatsAppUrl = "";

async function checkout() {
    if (cart.length === 0) return;

    // --- إضافة: التحقق من حالة المتجر قبل البدء (8 صباحاً - 10 مساءً) ---
    const currentHour = new Date().getHours();
    if (currentHour < 8 || currentHour >= 22) {
        alert("نعتذر منك، المتجر مغلق الآن. يمكنك الطلب غداً بدءاً من الساعة 8:00 صباحاً.");
        return;
    }
    // -------------------------------------------------------

    // --- إضافة: طلب رقم الهاتف لحفظ النقاط دون حذف أسطرك ---
    const customerPhone = prompt("يرجى إدخال رقم هاتفك لحفظ نقاط الولاء:");
    if (!customerPhone) return alert("الرقم ضروري لحفظ نقاطك وتأكيد الطلب!");
    // -------------------------------------------------------

    // --- إضافة: جلب ملاحظات الطلب من الحقل ---
    const orderNotes = document.getElementById('order-notes') ? document.getElementById('order-notes').value : "";
    // -------------------------------------------------------

    // --- إضافة: جلب تاريخ ووقت التوصيل المفضل ---
    const deliveryDate = document.getElementById('delivery-date') ? document.getElementById('delivery-date').value : "غير محدد";
    const deliveryTime = document.getElementById('delivery-time') ? document.getElementById('delivery-time').value : "غير محدد";
    // -------------------------------------------------------

    // --- إضافة: جلب الموقع الجغرافي (رابط الخريطة) ---
    const customerLocation = document.getElementById('location-url') ? document.getElementById('location-url').value : "";
    const manualAddress = document.getElementById('customer-address') ? document.getElementById('customer-address').value : "غير محدد";
    // -------------------------------------------------------

    // --- إضافة: التحقق من ساعات العمل (8 صباحاً - 10 مساءً) ---
    if (deliveryTime !== "غير محدد") {
        const hour = parseInt(deliveryTime.split(':')[0]);
        if (hour < 8 || hour >= 22) {
            alert("نعتذر، خدمة التوصيل في Stop & Shop متوفرة من 8:00 صباحاً حتى 10:00 مساءً فقط.");
            return;
        }
    }
    // -------------------------------------------------------

    const totalUsd = parseFloat(document.getElementById('total-usd').innerText);
    const payment = document.getElementById('payment-choice').value;
    
    // تعريف المتغيرات المطلوبة للرسالة وقاعدة البيانات
    const orderId = "SS" + Date.now().toString().slice(-6);
    const pointsEarned = Math.floor(totalUsd / 5); 

    try {
        // تحسين: تغيير نص زر الدفع لإشعار الزبون بالانتظار
        const checkoutBtn = document.querySelector('.checkout-btn'); // افترضنا وجود هذا الكلاس
        if(checkoutBtn) checkoutBtn.innerText = "جاري الحفظ... ⏳";

        // حفظ الطلب في Firebase - نفس أسطرك الأصلية (أضفنا الموقع الجغرافي)
        await db.collection("orders").add({
            orderId: orderId,
            customerPhone: customerPhone, // حفظ الرقم مع الطلب
            orderNotes: orderNotes,       // حفظ الملاحظات في قاعدة البيانات
            deliveryDate: deliveryDate,   // حفظ تاريخ التوصيل
            deliveryTime: deliveryTime,   // حفظ وقت التوصيل
            customerLocation: customerLocation, // حفظ رابط الخريطة
            manualAddress: manualAddress,       // حفظ العنوان المكتوب
            total: totalUsd,
            totalPrice: totalUsd,
            items: cart,
            points: pointsEarned,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            payment: payment
        });

        // --- إضافة: تحديث رصيد نقاط الزبون الإجمالي في Firebase ---
        await updateCustomerPoints(customerPhone, pointsEarned);
        const totalPointsNow = await getCustomerPoints(customerPhone);
        // -------------------------------------------------------

        const trackingLink = `https://wa.me/96181479786?text=${encodeURIComponent("مرحباً، أود تتبع حالة طلبي رقم: #" + orderId)}`;

        let msg = `🛒 *طلب جديد من Stop & Shop*\n`;
        msg += `🔖 *رقم الطلب:* #${orderId}\n`;
        msg += `📞 *رقم الزبون:* ${customerPhone}\n`; // إضافة الرقم للرسالة
        msg += `--------------------------\n`;
        cart.forEach((item, i) => {
            msg += `${i + 1}- ${item.name} (الكمية: ${item.quantity})\n`;
        });
        msg += `--------------------------\n`;
        
        // --- إضافة: موعد التوصيل والعنوان للرسالة ---
        msg += `📅 *موعد التوصيل:* ${deliveryDate} | ${deliveryTime}\n`;
        msg += `📍 *العنوان:* ${manualAddress}\n`;
        if (customerLocation) {
            msg += `🗺️ *رابط الموقع:* ${customerLocation}\n`;
        }
        msg += `--------------------------\n`;

        // --- إضافة: إدراج الملاحظات في رسالة الواتساب إذا وجدت ---
        if (orderNotes.trim() !== "") {
            msg += `📝 *ملاحظات الطلب:* ${orderNotes}\n`;
            msg += `--------------------------\n`;
        }
        // -------------------------------------------------------

        msg += `💰 *الإجمالي:* $${totalUsd}\n`;
        msg += `💳 *الدفع:* ${payment}\n`;
        msg += `✨ *نقاط هذا الطلب:* ${pointsEarned} نقطة\n`;
        msg += `🏆 *إجمالي نقاطك الآن:* ${totalPointsNow} نقطة\n\n`; // إظهار الرصيد الكلي
        msg += `📍 *لتتبع حالة طلبك اضغط هنا:*\n${trackingLink}`;

        const finalUrl = `https://wa.me/96181479786?text=${encodeURIComponent(msg)}`;
        window.currentWhatsAppUrl = finalUrl; 

        if (payment === "عن طريق Whish Money") {
            const modal = document.getElementById('whish-payment-modal');
            if(modal) modal.style.display = 'flex';
            
            const numDisplay = document.getElementById('whish-num-display');
            if(numDisplay) {
                const numberToCopy = numDisplay.innerText;
                navigator.clipboard.writeText(numberToCopy).catch(err => {
                    console.error("فشل النسخ التلقائي: ", err);
                });
            }
        } else {
            setTimeout(() => {
                if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                    window.location.href = finalUrl; 
                } else {
                    const newWindow = window.open(finalUrl, '_blank');
                    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
                        window.location.href = finalUrl;
                    }
                }
            }, 500); 
        }

        localStorage.setItem('last_order', JSON.stringify(cart));

        const successIdDisplay = document.getElementById('success-order-id');
        if(successIdDisplay) successIdDisplay.innerText = "رقم الطلب: #" + orderId;
        
        const successModal = document.getElementById('success-modal');
        if(successModal) successModal.style.display = 'flex';

        cart = [];
        updateCartCount();
        renderCartItems();
        updateRewardProgress();
        localStorage.removeItem('stop_shop_cart');
        
        if (document.getElementById('order-notes')) document.getElementById('order-notes').value = "";
        if (document.getElementById('delivery-date')) document.getElementById('delivery-date').value = "";
        if (document.getElementById('delivery-time')) document.getElementById('delivery-time').value = "";
        if (document.getElementById('location-url')) document.getElementById('location-url').value = "";

        if(checkoutBtn) checkoutBtn.innerText = "إتمام الطلب";

    } catch (e) {
        console.error("Firebase Error:", e);
        alert("فشل في حفظ الطلب: " + e.message);
        const checkoutBtn = document.querySelector('.checkout-btn');
        if(checkoutBtn) checkoutBtn.innerText = "إتمام الطلب";
    }
}
function processWhishAndOpen() {
    // إخفاء الواجهة
    document.getElementById('whish-payment-modal').style.display = 'none';

    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        // محاولة فتح التطبيق
        window.location.href = "whish://";

        // إذا لم يفتح التطبيق خلال ثانية واحدة، فهذا يعني أنه غير موجود
        // سنقوم بتحويله فوراً للواتساب لتجنب رسالة الخطأ في Safari
        let checkApp = setTimeout(function() {
            window.location.href = window.currentWhatsAppUrl;
        }, 1500);

        // إذا نجح فتح التطبيق، المتصفح سيتوقف عن تشغيل الـ Script في الخلفية غالباً
        window.onblur = function() {
            clearTimeout(checkApp); // إلغاء التحويل التلقائي إذا خرج المستخدم من المتصفح للتطبيق
        };
    } else {
        window.open(window.currentWhatsAppUrl, '_blank');
    }
}

function closeWhishModal() {
    document.getElementById('whish-payment-modal').style.display = 'none';
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
// 7. إدارة المسؤول (Firebase CRUD)
async function saveProduct() {
    const id = document.getElementById('edit-product-id').value;
    const name = document.getElementById('new-name').value;
    const price = parseFloat(document.getElementById('new-price').value);
    const category = document.getElementById('new-category').value;
    const image = document.getElementById('new-image').value;
    // إضافة قيمة الـ checkbox الجديد
    const isOutOfStock = document.getElementById('out-of-stock-check').checked;
    
    // --- الإضافة الجديدة لجلب الباركود دون حذف أي سطر ---
    // تأكد أن id الحقل في الـ HTML هو فعلاً "new-barcode"
    const barcodeInput = document.getElementById('new-barcode');
    const barcode = barcodeInput ? barcodeInput.value.trim() : ""; 

    // --- الإضافة الجديدة لجلب الكمية المتوفرة ---
    const stockInput = document.getElementById('new-stock');
    const stock = stockInput ? parseInt(stockInput.value) : 0;

    // --- التعديل هنا: استخدام ID المطابق للـ HTML الخاص بك ---
    const oldPriceInput = document.getElementById('product-old-price');
    const oldPrice = oldPriceInput ? parseFloat(oldPriceInput.value) : null;

    if (!name || isNaN(price) || !image) return alert("أكمل البيانات!");

    const data = { 
        name, 
        price, 
        category, 
        image, 
        barcode, // حفظ الباركود الجديد في Firebase
        isOutOfStock: isOutOfStock || (stock <= 0), // تحديث الحالة تلقائياً إذا كانت الكمية 0
        stock, // حفظ الكمية المتوفرة الجديدة
        oldPrice: oldPrice || null, // حفظ السعر القديم إذا وجد لعمل عرض
        lastUpdated: Date.now() 
    };

    // إضافة تاريخ الإنشاء فقط عند الإضافة لأول مرة
    if (!id) {
        data.createdAt = Date.now();
    }

    try {
        if (id) {
            await db.collection("products").doc(id).update(data);
            alert("تم تحديث بيانات المنتج!");
        } else {
            await db.collection("products").add(data);
            alert("تمت إضافة المنتج الجديد!");
        }

        // --- تعديل لضمان عدم حدوث خطأ Null قبل استدعاء الفورم ---
        if (typeof resetForm === "function") resetForm();

        // --- الحل الآمن لمشكلة الـ style التي ظهرت في الصور ---
        // تم توسيع البحث ليشمل كافة الاحتمالات لضمان الإغلاق دون خطأ
        const modal = document.querySelector('.modal') || 
                      document.getElementById('edit-modal') || 
                      document.getElementById('product-modal') ||
                      document.querySelector('[style*="display: block"]'); // بحث عن أي نافذة مفتوحة حالياً

        if (modal && modal.style) {
            modal.style.display = 'none';
        } else {
            // محاولة أخيرة باستخدام دالة الإغلاق العامة
            if (typeof closeModal === "function") closeModal();
        }

    } catch (e) {
        // رسالة الخطأ أصبحت أوضح لتحديد ما إذا كانت المشكلة من Firebase أو من الكود
        console.error("Firebase Error:", e);
        alert("خطأ تقني: " + e.message);
    }
}
async function hashPassword(string) {
    // نقوم بتنظيف الكلمة من أي مسافات زائدة قبل التشفير
    const trimmedString = string.trim(); 
    const utf8 = new TextEncoder().encode(trimmedString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    if (!password) return;

    // تشفير الكلمة التي تدخلها الآن للمقارنة
    const encodedPassword = btoa(password);
    
    // هذا هو الكود المشفر لكلمة bassam1632004 (لا يمكن فهمه بالعين المجردة)
    const storedHash = "YmFzc2FtMTYzMjAwNA==";

    if (encodedPassword === storedHash) {
        isAdmin = true;
        document.getElementById('add-product-form').style.display = 'block';
        dashboard.style.display = 'block'; 
        loginBtn.innerHTML = '<i class="fas fa-user-shield"></i> خروج';
        
        // تفعيل الإشعارات والإحصائيات
        if ("Notification" in window) Notification.requestPermission();
        loadSalesStats(); 
        updateDashboardStats();
        displayProducts(products); 
        watchNewOrders();
        
        console.log("تم الدخول بنجاح");
    } else {
        alert("كلمة المرور خاطئة! تأكد من كتابة الأحرف الصغيرة.");
    }
}
// تعريف الدالة خارجاً ليكون الكود أنظف
function requestNotificationPermission() {
    if ("Notification" in window) { // التأكد أن المتصفح يدعم الإشعارات
        if (Notification.permission !== "granted") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    console.log("تم تفعيل الإشعارات بنجاح!");
                }
            });
        }
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
    
    // --- الأسطر المضافة لربط الباركود والكمية بالخانات (دون حذف ما سبق) ---
    if (document.getElementById('new-barcode')) {
        document.getElementById('new-barcode').value = product.barcode || '';
    }
    if (document.getElementById('new-stock')) {
        document.getElementById('new-stock').value = product.stock || 0;
    }
    // ------------------------------------------------------------------

    // تأشير الـ checkbox بناءً على حالة المنتج
    document.getElementById('out-of-stock-check').checked = product.isOutOfStock || false;

    document.getElementById('form-title').innerText = "تعديل: " + product.name;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // يضاف داخل دالة editProduct
document.getElementById('new-price-lbp').value = Math.round((product.price * rate) / 500) * 500;
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
    document.getElementById('new-barcode').value = "";
    document.getElementById('form-title').innerText = "إضافة منتج جديد";

    // --- الأسطر المضافة لتصفير الخانات الجديدة وضمان عودتها للقيمة 0 ---
    if(document.getElementById('purchase-price')) document.getElementById('purchase-price').value = "0";
    if(document.getElementById('new-price-lbp')) document.getElementById('new-price-lbp').value = "0";
    if(document.getElementById('profit-margin')) document.getElementById('profit-margin').value = "0%";
    if(document.getElementById('new-stock')) document.getElementById('new-stock').value = "";

    // إعادة لون نسبة الربح للوضع الطبيعي (الأخضر)
    if(document.getElementById('profit-margin')) {
        document.getElementById('profit-margin').style.color = "#2e7d32";
    }

    // وضع المؤشر تلقائياً على خانة الاسم لتسريع العمل
    document.getElementById('new-name').focus();
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

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
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

            <div style="border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; text-align: left; line-height: 1.8;">
                <div style="display: flex; justify-content: space-between; font-size: 16px;">
                    <span>المجموع بالدولار:</span>
                    <span style="font-weight: bold; color: #c0392b;">$${totalUsd}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 16px; margin-bottom: 10px;">
                    <span>المجموع باللبناني:</span>
                    <span style="font-weight: bold;">${totalLbp} L.L</span>
                </div>
                <div style="background: #fdf2f2; padding: 5px; border-radius: 5px; text-align: center; font-size: 13px;">
                    🎉 نقاطك المحصلة من هذه الفاتورة: <b>${points} نقطة</b>
                </div>
            </div>

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

    db.collection("orders").orderBy("timestamp", "desc").limit(20).get().then((querySnapshot) => {
        list.innerHTML = ""; 
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // تحويل Timestamp إلى تاريخ مقروء للفلترة
            const dateObj = data.date ? data.date.toDate() : new Date();
            const dateStr = dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD

            const row = document.createElement('tr');
            row.style.borderBottom = "1px solid #455a64";
            row.innerHTML = `
                <td style="padding: 10px;">#${data.orderId || '---'}</td>
                <td style="padding: 10px; font-weight: bold; color: #2ecc71;">$${(data.totalPrice || 0).toFixed(2)}</td>
                <td style="padding: 10px;" data-date="${dateStr}">${dateStr}</td>
                <td style="padding: 10px;">
                    <button onclick='printArchiveOrder(${JSON.stringify(data)})' 
                            style="background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-print"></i>
                    </button>
                </td>
            `;
            list.appendChild(row);
        });
        updateReports(); // تحديث المجموع بعد التحميل
    });
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
function searchOrders() {
    let input = document.getElementById("orderSearch").value.toUpperCase();
    let table = document.getElementById("ordersTable"); // تأكد أن هذا هو ID الجدول عندك
    let tr = table.getElementsByTagName("tr");

    for (let i = 1; i < tr.length; i++) { // نبدأ من 1 لتخطي رأس الجدول
        let td = tr[i].getElementsByTagName("td")[0]; // يفترض أن رقم الطلب في أول عمود
        if (td) {
            let txtValue = td.textContent || td.innerText;
            if (txtValue.toUpperCase().indexOf(input) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
}
// دالة البحث المتقدمة في الفواتير
function filterOrders() {
    let searchText = document.getElementById("orderSearch").value.toUpperCase();
    let selectedDate = document.getElementById("dateFilter").value;
    let table = document.getElementById("ordersTable");
    let tr = table.getElementsByTagName("tr");

    for (let i = 1; i < tr.length; i++) {
        let rowVisible = false;
        let tds = tr[i].getElementsByTagName("td");
        
        // البحث عن النص في أي عمود (رقم الطلب أو السعر)
        let idText = tds[0].textContent || tds[0].innerText;
        let matchesSearch = idText.toUpperCase().indexOf(searchText) > -1;

        // الفلترة حسب التاريخ (نفترض أن التاريخ في العمود الثالث index 2)
        let matchesDate = true;
        if (selectedDate !== "" && tds[2]) {
            let rowDate = tds[2].getAttribute("data-date") || tds[2].innerText;
            matchesDate = rowDate.includes(selectedDate);
        }

        if (matchesSearch && matchesDate) {
            tr[i].style.display = "";
        } else {
            tr[i].style.display = "none";
        }
    }
    updateReports();
}

// إعادة ضبط الفلاتر لإظهار كل الطلبات
function resetFilters() {
    document.getElementById("orderSearch").value = "";
    document.getElementById("dateFilter").value = "";
    filterOrders();
}
function updateReports() {
    let table = document.getElementById("ordersTable");
    let tr = table.getElementsByTagName("tr");
    
    let totalUSD = 0;
    let orderCount = 0;
    const rate = 89000; // سعر الصرف في متجرك

    for (let i = 1; i < tr.length; i++) {
        // نحسب فقط الصفوف الظاهرة (التي اجتازت الفلتر)
        if (tr[i].style.display !== "none") {
            let priceText = tr[i].getElementsByTagName("td")[1].innerText; // عمود المبلغ
            let price = parseFloat(priceText.replace('$', '').trim());
            
            if (!isNaN(price)) {
                totalUSD += price;
                orderCount++;
            }
        }
    }

    // تحديث الأرقام في الواجهة
    document.getElementById("report-order-count").innerText = orderCount;
    document.getElementById("report-total-usd").innerText = totalUSD.toFixed(2) + " $";
    document.getElementById("report-total-lbp").innerText = (totalUSD * rate).toLocaleString() + " ل.ل";
    window.addEventListener('load', () => {
    // تنبيه لمستخدمي الأندرويد و Chrome
   window.addEventListener('load', () => {
    // --- تسجيل الـ Service Worker ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker: Registered ✅'))
        .catch(err => console.log('Service Worker: Error ❌', err));
    }

    // --- الدوال الأصلية الخاصة بك ---
    loadProducts();      // جلب المنتجات
    loadSavedCart();     // استرجاع السلة
    checkFirstVisit();   // فحص الترحيب
    loadSalesStats();    // تحميل إحصائيات المبيعات
});

    // تنبيه مخصص لمستخدمي الأيفون (لأن Safari لا يدعم التثبيت التلقائي)
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.navigator.standalone;
    if (isIos) {
        setTimeout(() => {
            alert("للوصول السريع: اضغط على زر 'مشاركة' (Share) أسفل المتصفح ثم اختر 'إضافة إلى الشاشة الرئيسية' (Add to Home Screen) 📲");
        }, 6000);
    }
});
}
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // منع المتصفح من إظهار التنبيه الافتراضي فوراً
    e.preventDefault();
    deferredPrompt = e;

    // إظهار رسالة مخصصة للزبون بعد 3 ثوانٍ من دخول الموقع
    setTimeout(() => {
        showInstallBanner();
    }, 3000);
});

function showInstallBanner() {
    const banner = document.createElement('div');
    banner.style = "position:fixed; bottom:20px; left:20px; right:20px; background:#e74c3c; color:white; padding:15px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; z-index:9999; box-shadow:0 5px 15px rgba(0,0,0,0.3); animation: slideUp 0.5s ease;";
    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <img src="logo.jpg" style="width:40px; border-radius:8px;">
            <span style="font-weight:bold; font-size:14px;">ثبّت تطبيق Stop & Shop للطلب أسرع!</span>
        </div>
        <button id="install-btn" style="background:white; color:#e74c3c; border:none; padding:8px 15px; border-radius:8px; font-weight:bold; cursor:pointer;">تثبيت</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('install-btn').addEventListener('click', () => {
        banner.remove();
        if (deferredPrompt) {
            deferredPrompt.prompt(); // إظهار نافذة التثبيت الرسمية
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                }
                deferredPrompt = null;
            });
        }
    });
}
const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.navigator.standalone;

if (isIos) {
    setTimeout(() => {
        const iosBanner = document.createElement('div');
        iosBanner.style = "position:fixed; bottom:20px; left:20px; right:20px; background:#333; color:white; padding:15px; border-radius:12px; z-index:9999; text-align:center; box-shadow:0 5px 15px rgba(0,0,0,0.3);";
        iosBanner.innerHTML = `
            <p style="margin:0 0 10px 0; font-size:14px;">للحصول على التطبيق: اضغط على زر <img src="https://img.icons8.com/ios/50/ffffff/share.png" style="width:18px; vertical-align:middle;"> ثم <b>"Add to Home Screen"</b> 📲</p>
            <button onclick="this.parentElement.remove()" style="background:none; border:none; color:#aaa; text-decoration:underline; cursor:pointer;">إغلاق</button>
        `;
        document.body.appendChild(iosBanner);
    }, 5000); // يظهر بعد 5 ثوانٍ
}
window.addEventListener('load', () => {
    // تسجيل السيرفس وركر بالمسار الصحيح لـ GitHub Pages
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
        .then(() => console.log("SW Registered"))
        .catch(err => console.log("SW Failed", err));
    }

    // إظهار رسالة ترحيبية وتنبيه بالتثبيت بعد 3 ثوانٍ
    setTimeout(() => {
        // فحص إذا كان المستخدم قد ثبت التطبيق فعلاً
        const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        
        if (!isInstalled) {
            const installMsg = document.createElement('div');
            installMsg.style = "position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:12px 20px; border-radius:30px; z-index:10000; font-size:13px; white-space:nowrap; border:1px solid #e74c3c;";
            installMsg.innerHTML = "✨ ثبّت التطبيق الآن لتجربة تسوق أسرع! <button id='btn-ok' style='background:#e74c3c; border:none; color:white; padding:4px 10px; border-radius:15px; margin-right:10px; cursor:pointer;'>كيف؟</button>";
            document.body.appendChild(installMsg);

            document.getElementById('btn-ok').onclick = () => {
                const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
                alert(isIos ? "اضغط على زر المشاركة (Share) ثم 'Add to Home Screen' 📲" : "اضغط على الثلاث نقاط أعلى المتصفح ثم 'Install App' 📲");
                installMsg.remove();
            };
            
            // تختفي الرسالة تلقائياً بعد 10 ثوانٍ
            setTimeout(() => installMsg.remove(), 10000);
        }
    }, 3000);
});
// نضع هذا الكود داخل الجزء الخاص بالمسؤول (Admin)
function watchNewOrders() {
    db.collection("orders").orderBy("timestamp", "desc").limit(1)
    .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const order = change.doc.data();
                // التأكد أن الطلب جديد فعلاً وليس قديماً
                showOrderNotification(order);
            }
        });
    });
}

function showOrderNotification(order) {
    if (Notification.permission === "granted") {
        new Notification("🛒 طلب جديد في Stop & Shop!", {
            body: `رقم الطلب: #${order.orderId}\nالإجمالي: $${order.totalPrice}`,
            icon: "logo.png" // ضع رابط شعار محلك هنا
        });
        // إضافة صوت تنبيه
        const audio = new Audio('https://www.soundjay.com/buttons/sounds/beep-07a.mp3');
        audio.play();
    }
}
// دالة لمراقبة الطلبات الجديدة وإظهار تنبيه داخل الموقع
function enableLiveOrderAlerts() {
    // نراقب جدول الطلبات
    db.collection("orders").onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            // إذا تمت إضافة طلب جديد وكان المسؤول مسجلاً دخوله
            if (change.type === "bassam1632004" && isAdmin) {
                
                // 1. تشغيل صوت "رنة" مميزة
                const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                alertSound.play();

                // 2. إظهار رسالة تنبيه سريعة في أعلى الشاشة
                showTopAlert("🔔 وصل طلب جديد الآن!");
                
                // 3. تحديث الإحصائيات تلقائياً أمامك
                updateDashboardStats();
            }
        });
    });
}

// دالة بسيطة لإظهار رسالة جمالية في أعلى الصفحة
function showTopAlert(msg) {
    const alertDiv = document.createElement('div');
    alertDiv.innerHTML = msg;
    alertDiv.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #e74c3c; color: white; padding: 15px 30px;
        border-radius: 50px; z-index: 9999; font-weight: bold;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3); animation: slideDown 0.5s ease;
    `;
    document.body.appendChild(alertDiv);
    
    // تختفي الرسالة تلقائياً بعد 5 ثوانٍ
    setTimeout(() => alertDiv.remove(), 5000);
}
function showProgress(percent) {
    const container = document.getElementById('progress-container');
    const bar = document.getElementById('progress-bar');
    container.style.display = 'block';
    bar.style.width = percent + '%';
    
    if (percent >= 100) {
        setTimeout(() => { container.style.display = 'none'; }, 500);
    }
}
// --- دالة تحفيز الزبون الجديدة (شريط الـ 50$) ---
function updateRewardProgress() {
    // حساب إجمالي السلة الحالية
    const totalUsd = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const goal = 50;
    const progressBar = document.getElementById('reward-progress-bar'); // تأكد أن الـ ID مطابق في الـ HTML
    const rewardMsg = document.getElementById('reward-message');

    if (!progressBar || !rewardMsg) return;

    let percentage = Math.min((totalUsd / goal) * 100, 100);
    progressBar.style.width = percentage + "%";

    if (totalUsd === 0) {
        rewardMsg.innerHTML = `أضف بضاعة بـ <span style="color:#e74c3c">$${goal}</span> لتاخد توصيل مجاني! 🚚`;
        progressBar.style.background = "#e74c3c";
    } else if (totalUsd < goal) {
        const diff = (goal - totalUsd).toFixed(2);
        rewardMsg.innerHTML = `باقي لك <span style="color:#e74c3c">$${diff}</span> بس وبتربح التوصيل المجاني! 😍`;
        progressBar.style.background = "linear-gradient(90deg, #e74c3c, #f1c40f)";
        sessionStorage.removeItem('reward_celebrated'); // إعادة السماح بالاحتفال إذا نقص المبلغ
    } else {
        rewardMsg.innerHTML = `<span style="color:#27ae60">🎉 مبروك! طلبيتك صارت مؤهلة للتوصيل المجاني!</span>`;
        progressBar.style.background = "#27ae60";
        
        // إطلاق الاحتفال لمرة واحدة فقط عند الوصول للهدف
        if (!sessionStorage.getItem('reward_celebrated')) {
            if (typeof launchConfetti === "function") launchConfetti();
            sessionStorage.setItem('reward_celebrated', 'true');
        }
    }
}
function calculateCartTotal() {
    let total = 0;
    cart.forEach(item => {
        total += item.price * item.quantity;
    });

    // استدعاء دالة شريط الـ 50$ الجديدة
    updateRewardProgress(total);

    // تحديث رقم الإجمالي العادي في السلة
    document.getElementById('cart-total').innerText = total.toFixed(2);
}
let html5QrCode;

function startScanner() {
    const wrapper = document.getElementById('scanner-wrapper');
    wrapper.style.display = 'flex';

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#reader'), // مكان ظهور الكاميرا
            constraints: {
                facingMode: "environment", // الكاميرا الخلفية
                aspectRatio: { min: 1, max: 2 }
            },
        },
        decoder: {
            // تحديد الأنواع المستخدمة في لبنان (EAN هي الأهم للمواد الغذائية)
            readers: ["ean_reader", "ean_8_reader", "code_128_reader", "upc_reader"]
        },
        locate: true // ميزة تحديد مكان الباركود في الصورة لتسريع القراءة
    }, function (err) {
        if (err) {
            console.error(err);
            alert("خطأ في تشغيل الكاميرا");
            return;
        }
        Quagga.start();
    });

    // ماذا يفعل الكود عند قراءة الباركود بنجاح
    Quagga.onDetected(function (result) {
    const code = result.codeResult.code;
    if (code) {
        // 1. وضع الرقم في خانة البحث
        document.getElementById('search-input').value = code;
        
        // 2. البحث عن المنتج في القائمة لديك
        const foundProduct = products.find(p => p.barcode === code);

        if (foundProduct) {
            // إيقاف الماسح فور إيجاد المنتج
            stopScanner();
            
            // 3. عرض المنتج "كملصق مرتب" في أعلى الصفحة أو في مودال
            showProductSticker(foundProduct);
            
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
    }
});

// دالة رسم الملصق المرتب
function showProductSticker(product) {
    // --- إضافة سطر الصوت هنا ---
    const audio = new Audio('https://www.soundjay.com/buttons/beep-07a.mp3');
    audio.play().catch(e => console.log("الصوت يحتاج تفاعل أولاً"));
    // -------------------------

    const container = document.getElementById('products-container');
    
    // مسح المحتوى الحالي لإظهار المنتج الممسوح فقط بشكل بارز
    container.innerHTML = `
        <div class="scanned-product-result" style="max-width: 260px; padding: 10px; margin: 10px auto; border: 2px solid #27ae60; border-radius: 12px; text-align: center; background: white;">
            <div class="sticker-header" style="font-size: 0.85rem; color: #27ae60; font-weight: bold; margin-bottom: 5px;">
                <i class="fas fa-check-circle"></i> تم التعرف
            </div>
            
            <img src="${product.image}" alt="${product.name}" style="width: 70px; height: 70px; object-fit: contain;">
            
            <div class="sticker-info">
                <h3 style="font-size: 0.95rem; margin: 5px 0;">${product.name}</h3>
                <span class="sticker-category" style="font-size: 0.75rem; color: #777;">${product.category}</span>
                <div class="sticker-price" style="font-size: 1.3rem; font-weight: bold; color: #e74c3c;">$${product.price.toFixed(2)}</div>
            </div>

            <div class="sticker-actions" style="margin-top: 8px;">
                <button class="add-btn-large" onclick="addToCart('${product.id}'); alert('تمت الإضافة للسلة!')" style="background: #27ae60; color: white; border: none; padding: 8px; font-size: 0.9rem; width: 100%; border-radius: 20px; cursor: pointer;">
                    <i class="fas fa-cart-plus"></i> إضافة للسلة
                </button>
                
                <button class="close-sticker" onclick="location.reload()" style="font-size: 0.75rem; margin-top: 8px; background: none; border: none; color: #999; cursor: pointer; display: block; width: 100%;">
                    <i class="fas fa-times"></i> إغلاق
                </button>
            </div>
        </div>
    `;
    
    // تمرير الشاشة للأعلى لرؤية الملصق فوراً
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
}

// تعديل دالة الإيقاف لتناسب المكتبة الجديدة
function stopScanner() {
    Quagga.stop();
    document.getElementById('scanner-wrapper').style.display = 'none';
}
function openLoginModal() {
    document.getElementById('unified-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('unified-modal').style.display = 'none';
    // إعادة تعيين الواجهة عند الإغلاق
    document.getElementById('admin-action-section').style.display = 'none';
    document.getElementById('points-result').innerHTML = '';
}

// دالة فك قفل الإدارة داخل النافذة
function unlockAdmin() {
    const pass = prompt("أدخل كلمة مرور المسؤول:");
    if (pass === "1234") {
        document.getElementById('admin-action-section').style.display = 'block';
        document.getElementById('admin-trigger').style.display = 'none';
    } else {
        alert("خطأ!");
    }
}

async function addPointsViaAdmin() {
    const phone = document.getElementById('manual-customer-phone').value;
    const amount = parseFloat(document.getElementById('manual-purchase-amount').value);
    const statusLabel = document.getElementById('admin-action-status');

    // التحقق من البيانات
    if (!phone || isNaN(amount) || amount <= 0) {
        alert("يرجى إدخال رقم هاتف صحيح ومبلغ أكبر من صفر.");
        return;
    }

    // حساب النقاط بناءً على قاعدتك (5$ = 1 نقطة)
    const earnedPoints = Math.floor(amount / 5);

    try {
        statusLabel.innerText = "⏳ جاري تحديث بيانات الزبون...";
        statusLabel.style.color = "#f39c12";

        // تحديث رصيد الزبون في Firestore
        const userRef = db.collection("users").doc(phone);
        
        await userRef.set({
            phone: phone,
            points: firebase.firestore.FieldValue.increment(earnedPoints),
            lastManualUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            lastPurchaseAmount: amount
        }, { merge: true });

        // نجاح العملية
        statusLabel.style.color = "#27ae60";
        statusLabel.innerText = `✅ نجح الأمر! تمت إضافة ${earnedPoints} نقطة للرقم ${phone}`;
        
        // تفريغ الخانات للاستخدام التالي
        document.getElementById('manual-customer-phone').value = "";
        document.getElementById('manual-purchase-amount').value = "";

    } catch (error) {
        console.error("Error updating points:", error);
        statusLabel.style.color = "#c0392b";
        statusLabel.innerText = "❌ فشل التحديث، تأكد من اتصال الإنترنت.";
    }
}
// 1. جلب قائمة الزبائن من Firebase وعرضها في الجدول
function loadCustomers() {
    db.collection("users").orderBy("points", "desc").onSnapshot((snapshot) => {
        const list = document.getElementById('customers-list');
        list.innerHTML = ""; // مسح الجدول القديم

        snapshot.forEach((doc) => {
            const user = doc.data();
            const date = user.lastUpdate ? user.lastUpdate.toDate().toLocaleDateString('ar-EG') : 'لا يوجد';
            list.innerHTML += `
    <tr>
        <td><b>${doc.id}</b></td>
        <td class="points-badge">${user.points || 0} نقطة</td>
        <td>${date}</td>
        <td>
            <button class="quick-add" onclick="quickAdd('${doc.id}')">إضافة $5</button>
            <button class="delete-btn" onclick="deleteCustomer('${doc.id}')" style="background: #ebedef; color: #c0392b; border: 1px solid #c0392b; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-right: 5px;">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    </tr>
`;
        });
    });
}
async function deleteCustomer(phone) {
    if (confirm(`هل أنت متأكد من حذف الزبون صاحب الرقم (${phone}) نهائياً من نظام الولاء؟`)) {
        try {
            const db = firebase.firestore();
            await db.collection("users").doc(phone).delete();
            alert("✅ تم حذف الزبون بنجاح");
        } catch (error) {
            console.error("خطأ في الحذف: ", error);
            alert("❌ فشل الحذف، حاول مرة أخرى");
        }
    }
}

// 2. دالة الإضافة اليدوية (المبلغ المخصص)
async function confirmManualPoints() {
    const phone = document.getElementById('admin-phone').value;
    const amount = parseFloat(document.getElementById('admin-amount').value);
    
    if (!phone || !amount) return alert("يرجى ملء الخانات");

    const pointsEarned = Math.floor(amount / 5);

    await db.collection("users").doc(phone).set({
        points: firebase.firestore.FieldValue.increment(pointsEarned),
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    alert(`تمت إضافة ${pointsEarned} نقطة بنجاح!`);
    hideManualAddForm();
}

// 3. وظيفة سريعة لإضافة نقاط (مثلاً عند شراء قطعة بـ 5$)
async function quickAdd(phone) {
    await db.collection("users").doc(phone).update({
        points: firebase.firestore.FieldValue.increment(1),
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// تشغيل جلب البيانات عند فتح الصفحة
loadCustomers();

// دالات إظهار وإخفاء النافذة
function showManualAddForm() { document.getElementById('manual-points-modal').style.display = 'flex'; }
function hideManualAddForm() { document.getElementById('manual-points-modal').style.display = 'none'; }
function filterCustomers() {
    let input = document.getElementById("searchCustomer");
    let filter = input.value.toLowerCase();
    let table = document.getElementById("customers-table");
    let tr = table.getElementsByTagName("tr");

    // نمر على كل صفوف الجدول (باستثناء الرأس)
    for (let i = 1; i < tr.length; i++) {
        let td = tr[i].getElementsByTagName("td")[0]; // العمود الأول (رقم الهاتف)
        if (td) {
            let txtValue = td.textContent || td.innerText;
            if (txtValue.toLowerCase().indexOf(filter) > -1) {
                tr[i].style.display = ""; // إظهار الصف
            } else {
                tr[i].style.display = "none"; // إخفاء الصف
            }
        }
    }
}
// دالة لتحديث الكمية في واجهة العرض
// دالة لتحديث الكمية مع مراعاة المخزن المتوفر
function updateQty(productId, change) {
    const qtyInput = document.getElementById(`qty-${productId}`);
    
    // البحث عن المنتج في القائمة لمعرفة الكمية المتوفرة (Stock)
    const product = products.find(p => p.id === productId);

    if (qtyInput && product) {
        let currentQty = parseInt(qtyInput.value) || 1;
        let newQty = currentQty + change;

        // 1. منع العداد من النزول عن 1
        if (change === -1 && newQty >= 1) {
            qtyInput.value = newQty;
        } 
        
        // 2. منع العداد من تجاوز الكمية الموجودة في المخزن
        else if (change === 1) {
            if (newQty <= product.stock) {
                qtyInput.value = newQty;
            } else {
                // اختياري: تنبيه بسيط للزبون أنه وصل للحد الأقصى
                alert(`نعتذر، لا يوجد سوى ${product.stock} قطع متوفرة من هذا المنتج.`);
            }
        }
    }
}
function updateOffersBanner(productsList) {
    const bannerSection = document.getElementById('offers-banner');
    const slider = document.getElementById('banner-slider');
    
    // نختار فقط المنتجات التي عليها عرض وليست نافذة
    const offerProducts = productsList.filter(p => p.oldPrice && parseFloat(p.oldPrice) > parseFloat(p.price) && !p.isOutOfStock);

    if (offerProducts.length > 0) {
        bannerSection.style.display = 'block';
        slider.innerHTML = '';

        offerProducts.forEach(product => {
            const discount = Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
            
            slider.innerHTML += `
                <div class="banner-item">
                    <img src="${product.image}">
                    <div style="flex-grow: 1; text-align: right;">
                        <span class="banner-discount-badge">خصم ${discount}%</span>
                        <h4 style="margin: 5px 0; font-size: 0.9rem;">${product.name}</h4>
                        <div style="display: flex; gap: 8px; align-items: baseline;">
                            <span style="color: #27ae60; font-weight: bold; font-size: 1.1rem;">$${product.price}</span>
                            <span style="text-decoration: line-through; color: #888; font-size: 0.8rem;">$${product.oldPrice}</span>
                        </div>
                        <button onclick="addToCart('${product.id}')" style="background:#27ae60; color:white; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; width:100%; margin-top:5px;">أضف للعرض</button>
                    </div>
                </div>
            `;
        });
    } else {
        bannerSection.style.display = 'none';
    }
}
function updateShopStatus() {
    const statusText = document.getElementById('shop-status-text');
    const body = document.body; // للتحكم في خلفية الموقع
    if (!statusText) return;

    const now = new Date();
    const hour = now.getHours(); // يجلب الساعة الحالية (0-23)
    const minutes = now.getMinutes();

    // تحديد ساعات العمل (من 8:00 صباحاً حتى 10:00 مساءً)
    const openingHour = 8;
    const closingHour = 22;

    if (hour >= openingHour && hour < closingHour) {
        // --- حالة المتجر: مفتوح ---
        // تحسين: إضافة عد تنازلي بسيط إذا اقترب موعد الإغلاق (أقل من ساعة)
        if (hour === closingHour - 1) {
            statusText.innerText = `مفتوح (يغلق خلال ${60 - minutes} دقيقة) ⏳`;
            statusText.style.color = "#f39c12"; // لون برتقالي للتنبيه
        } else {
            statusText.innerText = "مفتوح الآن ✅";
            statusText.style.color = "#27ae60"; // أخضر مريح للعين
        }
        
        // إرجاع الألوان العادية للموقع
        body.style.backgroundColor = "white"; 
        body.style.filter = "none";
        
    } else {
        // --- حالة المتجر: مغلق ---
        // تحسين: إخبار الزبون متى سيفتح المتجر
        let waitHours = (hour < openingHour) ? (openingHour - hour) : (24 - hour + openingHour);
        statusText.innerText = `مغلق الآن ❌ (يفتح بعد ${waitHours} ساعة)`;
        
        statusText.style.color = "#e74c3c"; // أحمر واضح
        
        // تطبيق "الوضع الليلي" أو التعتيم البصري
        // هذا يعطي إيحاء للزبون أن المتجر في حالة راحة
        body.style.transition = "all 0.5s ease"; // انتقال ناعم للألوان
        body.style.backgroundColor = "#f4f4f4"; // خلفية رمادية فاتحة
        
        // اختياري: إضافة فئة CSS إذا كنت تريد تحكم أكبر بالألوان
        // body.classList.add('shop-closed-mode');
    }
}

// تشغيل الدالة عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', updateShopStatus);

// تحديث الحالة كل دقيقة للتأكد من دقة الوقت إذا ترك الزبون الصفحة مفتوحة
setInterval(updateShopStatus, 60000);
function repeatLastOrder() {
    const lastOrder = localStorage.getItem('last_order');
    if (lastOrder) {
        cart = JSON.parse(lastOrder);
        updateCartCount();
        renderCartItems();
        updateRewardProgress();
        alert("تمت إضافة منتجات آخر طلب إلى سلتك!");
    } else {
        alert("لا يوجد طلبات سابقة مسجلة.");
    }
}

function closeSuccessModal() {
    document.getElementById('success-modal').style.display = 'none';
    location.reload(); // لإعادة تحديث الصفحة وتنظيف الواجهة
}
async function checkMyPoints() {
    const phoneInput = document.getElementById('check-phone-input');
    const resultDiv = document.getElementById('points-result');

    // التأكد من إدخال رقم
    if (!phoneInput || !phoneInput.value.trim()) {
        alert("يرجى إدخال رقم الهاتف أولاً!");
        return;
    }

    const phone = phoneInput.value.trim();
    resultDiv.style.color = "#2c3e50"; // لون محايد أثناء التحميل
    resultDiv.innerText = "جاري الفحص... ⏳";

    try {
        // البحث في مجموعة users (نفس المجموعة التي تستخدمها في دالة التحديث)
        const userRef = db.collection("users").doc(phone);
        const doc = await userRef.get();

        if (doc.exists) {
            const userData = doc.data();
            const totalPoints = userData.points || 0;
            
            // عرض النتيجة بنجاح
            resultDiv.style.color = "#27ae60"; // اللون الأخضر
            resultDiv.innerHTML = `رصيدك الحالي هو: <span style="font-size: 28px;">${totalPoints}</span> نقطة 🏆`;
        } else {
            // الرقم غير موجود
            resultDiv.style.color = "#e74c3c"; // اللون الأحمر
            resultDiv.innerText = "هذا الرقم غير مسجل في نظام النقاط لدينا.";
        }
    } catch (error) {
        console.error("خطأ في جلب النقاط:", error);
        resultDiv.style.color = "#e74c3c";
        resultDiv.innerText = "حدث خطأ أثناء الاتصال. تأكد من الإنترنت.";
    }
}
function getLocation() {
    const status = document.getElementById('location-status');
    const addressInput = document.getElementById('customer-address');
    const locationUrlInput = document.getElementById('location-url');

    if (!navigator.geolocation) {
        status.innerText = "متصفحك لا يدعم تحديد الموقع.";
        return;
    }

    status.innerText = "جاري تحديد موقعك... ⏳";

    navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        // إنشاء رابط خرائط جوجل
        const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;
        locationUrlInput.value = mapLink;
        
        status.style.color = "#27ae60";
        status.innerText = "✅ تم تحديد الموقع بنجاح!";
        addressInput.value = "تم تحديد الموقع عبر الخريطة 📍";
    }, (error) => {
        status.style.color = "#e74c3c";
        status.innerText = "فشل التحديد: يرجى إعطاء الإذن للموقع.";
    });
}
// ابحث عن الجزء المسؤول عن إظهار رسائل الخطأ واستبدله بهذا ليكون أكثر أماناً
function updateStatus(msg, isError) {
    const statusEl = document.getElementById('status-msg');
    // التحقق أولاً إذا كان العنصر موجوداً قبل محاولة تغيير الـ style
    if (statusEl) {
        statusEl.innerText = msg;
        statusEl.style.display = 'block';
        statusEl.style.color = isError ? 'red' : 'green';
    } else {
        // إذا لم يجد العنصر، يكتفي بإظهار تنبيه عادي ولا يعطل الكود
        alert(msg);
    }
}
async function loadTodaySales() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // --- الجزء المضاف: جلب الموظفين الموجودين حالياً فقط ---
    const staffSnapshot = await db.collection("staff").get();
    const activeStaff = [];
    staffSnapshot.forEach(doc => {
        const sData = doc.data();
        activeStaff.push(sData.name || sData.staff);
    });
    // --------------------------------------------------

    db.collection("sales")
        .where("time", ">=", startOfDay)
        .onSnapshot(snapshot => {
            let totalUSD = 0;
            let ordersCount = snapshot.size;
            let staffStats = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                // جلب القيمة كرقم مباشرة بعد تحديث finishOrder
                const saleAmount = parseFloat(data.totalUSD) || 0;
                const employee = data.employee || "مدير الصالة";

                totalUSD += saleAmount;

                // التعديل: التحقق إذا كان الموظف لا يزال نشطاً قبل إضافته للجدول
                if (activeStaff.includes(employee)) {
                    if (!staffStats[employee]) {
                        staffStats[employee] = { count: 0, total: 0 };
                    }
                    staffStats[employee].count += 1;
                    staffStats[employee].total += saleAmount;
                }
            });

            // تحديث العناصر في الواجهة
            document.getElementById('today-total-usd').innerText = "$ " + totalUSD.toFixed(2);
            document.getElementById('today-orders-count').innerText = ordersCount;

            const tableBody = document.getElementById('staff-performance-body');
            tableBody.innerHTML = '';
            
            for (const [name, stats] of Object.entries(staffStats)) {
                tableBody.innerHTML += `
                    <tr>
                        <td>${name}</td>
                        <td>${stats.count} فاتورة</td>
                        <td class="total-cell">${stats.total.toFixed(2)} $</td>
                        <td style="text-align: center;">
                            <button onclick="deleteStaffMember('${name}')" 
                                    style="background: #ff5252; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-family: 'Segoe UI';">
                                حذف الموظف
                            </button>
                        </td>
                    </tr>
                `;
            }
        });
}

// تشغيل الدالة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', loadTodaySales);
async function deleteStaffMember(staffName) {
    if (confirm(`هل أنت متأكد من حذف الموظف "${staffName}" نهائياً؟`)) {
        try {
            const snapshot = await db.collection("staff").where("name", "==", staffName).get();
            let targetSnapshot = snapshot;
            if (targetSnapshot.empty) {
                targetSnapshot = await db.collection("staff").where("staff", "==", staffName).get();
            }

            if (targetSnapshot.empty) {
                alert("تعذر العثور على الموظف!");
                return;
            }

            const batch = db.batch();
            targetSnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();

            alert("تم الحذف بنجاح ✅");
            
            // السطر الأهم: تحديث الصفحة ليختفي الاسم من الجدول فوراً
            location.reload(); 

        } catch (error) {
            alert("حدث خطأ: " + error.message);
        }
    }
    // بعد نجاح عملية الحذف في Firebase
await batch.commit();
alert("تم حذف الموظف بنجاح ✅");

// تحديث الصفحة لإعادة بناء الجدول من البيانات الجديدة
location.reload();
}
async function addNewStaff() {
    const nameInput = document.getElementById('new-staff-name');
    const pinInput = document.getElementById('new-staff-pin');
    
    const name = nameInput.value.trim();
    const pin = pinInput.value.trim();

    if (name === "" || pin === "") {
        alert("يرجى إدخال الاسم وكلمة المرور!");
        return;
    }

    try {
        await db.collection("staff").add({
            name: name,
            pin: pin, // حفظ كلمة المرور
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("تم حفظ الموظف " + name + " بنجاح ✅");
        nameInput.value = "";
        pinInput.value = "";
        
        if(typeof loadTodaySales === "function") loadTodaySales();
        
    } catch (error) {
        alert("خطأ: " + error.message);
    }
}
async function resetTodaySales() {
    if (confirm("هل أنت متأكد من تصفير مبيعات اليوم؟ لا يمكن التراجع عن هذه الخطوة!")) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        try {
            // جلب مبيعات اليوم فقط
            const snapshot = await db.collection("sales")
                                    .where("time", ">=", startOfDay)
                                    .get();

            if (snapshot.empty) {
                alert("العدادات صفر بالفعل!");
                return;
            }

            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            alert("تم تصفير العدادات بنجاح. ابدأ يومك بالرزق الحلال! ✅");
            
            // تحديث الأرقام في الواجهة فوراً
            location.reload(); 

        } catch (error) {
            alert("حدث خطأ أثناء التصفير: " + error.message);
        }
    }
}
async function saveProductToFirebase() {
    const barcode = document.getElementById('add-product-barcode').value.trim();
    const name = document.getElementById('add-product-name').value.trim();
    const price = parseFloat(document.getElementById('add-product-price').value) || 0;
    const stock = parseInt(document.getElementById('add-product-stock').value) || 0;
    // --- الأسطر المضافة لجلب القيم الجديدة ---
    const purchasePrice = parseFloat(document.getElementById('purchase-price').value) || 0;

    if (barcode === "" || name === "") {
        alert("يرجى مسح الباركود وإدخال اسم المنتج!");
        return;
    }

    try {
        // التحقق إذا كان الباركود موجوداً مسبقاً لمنع التكرار
        const existing = await db.collection("products").where("barcode", "==", barcode).get();
        if (!existing.empty) {
            alert("⚠️ هذا الباركود مسجل مسبقاً لمنتج آخر!");
            return;
        }

        // إضافة المنتج الجديد
        await db.collection("products").add({
            barcode: barcode,
            name: name,
            price: price,
            stock: stock,
            // --- حفظ سعر الشراء في قاعدة البيانات ---
            purchasePrice: purchasePrice,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("تم حفظ المنتج بنجاح في مبيعات Stop & Shop ✅");
        
        // تفريغ الخانات للإدخال التالي
        document.getElementById('add-product-barcode').value = "";
        document.getElementById('add-product-name').value = "";
        document.getElementById('add-product-price').value = "0"; // تعديل للقيمة 0
        document.getElementById('add-product-stock').value = "";
        
        // --- تفريغ الخانات الجديدة وتصفير نسبة الربح ---
        document.getElementById('purchase-price').value = "0";
        if(document.getElementById('new-price-lbp')) document.getElementById('new-price-lbp').value = "0";
        if(document.getElementById('profit-margin')) document.getElementById('profit-margin').value = "0%";

        // إعادة التركيز (Focus) على خانة الباركود للمنتج التالي
        document.getElementById('add-product-barcode').focus();

    } catch (error) {
        alert("حدث خطأ أثناء الحفظ: " + error.message);
    }
}
// دالة التحويل من دولار إلى ليرة (عند الكتابة في خانة الدولار)
function convertToLBP() {
    // نستخدم الأسماء التي وضعتها أنت في HTML
    const usdInput = document.getElementById('new-price'); 
    const lbpInput = document.getElementById('new-price-lbp');
    if (usdInput && lbpInput) {
        const val = parseFloat(usdInput.value) || 0;
        lbpInput.value = Math.round((val * exchangeRate) / 500) * 500;
        calculateProfit(); // نحدث الربح تلقائياً
    }
}

function convertToUSD() {
    const usdInput = document.getElementById('new-price');
    const lbpInput = document.getElementById('new-price-lbp');
    if (usdInput && lbpInput && exchangeRate > 0) {
        const val = parseFloat(lbpInput.value) || 0;
        usdInput.value = (val / exchangeRate).toFixed(2);
        calculateProfit();
    }
}


// دالة لتحديث عرض سعر الصرف في الواجهة
function displayCurrentRate() {
    const rateElement = document.getElementById('admin-rate-display');
    if (rateElement) {
        rateElement.innerText = "سعر الصرف الحالي: " + rate.toLocaleString() + " L.L";
    }
}

// تشغيل العرض عند فتح الصفحة
window.onload = function() {
    displayCurrentRate();
};
// دالة لتغيير سعر الصرف الشامل
function updateGlobalRate() {
    // --- طلب السعرين من المستخدم مع الحفاظ على الأسعار الحالية كاقتراح ---
    let newRate = prompt("أدخل سعر صرف التسعير (للإدارة - مثلاً 90000):", rate);
    let newSellingRate = prompt("أدخل سعر صرف البيع (للزبون - مثلاً 89000):", localStorage.getItem('sellingRate') || 89000);
    
    if (newRate !== null && newRate !== "" && !isNaN(newRate)) {
        rate = parseFloat(newRate);
        
        // 1. حفظ السعر الجديد في ذاكرة المتصفح
        localStorage.setItem('exchangeRate', rate);
        
        // --- حفظ سعر البيع الجديد أيضاً في المتصفح لكي يقرأه الكاشير ---
        if (newSellingRate !== null && newSellingRate !== "" && !isNaN(newSellingRate)) {
            localStorage.setItem('sellingRate', parseFloat(newSellingRate));
        }
        
        // 2. تحديث النص الظاهر في الأعلى
        const rateDisplay = document.getElementById('admin-rate-display');
        if (rateDisplay) {
            rateDisplay.innerText = rate.toLocaleString() + " L.L";
        }

        // --- الجزء المضاف لجعل السعر "يتحول" فوراً أمامك ---
        const usdInput = document.getElementById('new-price');
        const lbpInput = document.getElementById('new-price-lbp');

        if (usdInput.value !== "") {
            // إذا كنت كاتب سعر بالدولار، سيقوم بتحديث الليرة فوراً بناءً على الصرف الجديد
            convertToLBP(); 
        } else if (lbpInput.value !== "") {
            // إذا كنت كاتب سعر بالليرة، سيقوم بتحديث الدولار فوراً
            convertToUSD();
        }
        // --------------------------------------------------
        
        alert("تم تحديث الأسعار بنجاح ✅\nالتسعير: " + rate + " | البيع: " + newSellingRate);
    }
}

// تأكد أن الصفحة تقرأ السعر المحفوظ عند التحميل
window.addEventListener('load', () => {
    let savedRate = localStorage.getItem('exchangeRate');
    if (savedRate) {
        rate = parseFloat(savedRate);
        // التحقق من وجود العنصر قبل تحديثه لتجنب أخطاء الكونسول
        const rateDisplay = document.getElementById('admin-rate-display');
        if (rateDisplay) {
            rateDisplay.innerText = rate.toLocaleString() + " L.L";
        }
    }
});
function printProductLabel() {
    const name = document.getElementById('new-name').value;
    const priceUSD = document.getElementById('new-price').value;
    const priceLBP = document.getElementById('new-price-lbp').value;
    const barcode = document.getElementById('new-barcode').value;

    if (!name || !barcode) {
        alert("يرجى إدخال اسم المنتج والباركود أولاً!");
        return;
    }

    // تصميم الملصق
    const labelHTML = `
        <div style="width: 40mm; height: 30mm; padding: 2mm; box-sizing: border-box; text-align: center; font-family: Arial; direction: rtl; border: 1px solid #eee;">
            <div style="font-size: 10pt; font-weight: bold; white-space: nowrap; overflow: hidden; margin-bottom: 2mm;">
                Stop & Shop - ${name}
            </div>
            <div style="font-size: 11pt; color: #000; font-weight: bold;">
                ${parseInt(priceLBP).toLocaleString()} L.L
            </div>
            <div style="font-size: 9pt; margin-bottom: 2mm;">
                Price: $${parseFloat(priceUSD).toFixed(2)}
            </div>
            <div style="display: flex; justify-content: center; align-items: center;">
                <svg id="barcode-svg"></svg>
            </div>
            <div style="font-size: 8pt;">${barcode}</div>
        </div>
    `;

    // فتح نافذة طباعة جديدة للملصق فقط
    const printWindow = window.open('', '_blank', 'width=400,height=400');
    printWindow.document.write('<html><head><title>Print Label</title>');
    printWindow.document.write('<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>');
    printWindow.document.write('</head><body style="margin:0; padding:0;">');
    printWindow.document.write(labelHTML);
    printWindow.document.write(`
        <script>
            window.onload = function() {
                JsBarcode("#barcode-svg", "${barcode}", {
                    format: "CODE128",
                    width: 1.5,
                    height: 30,
                    displayValue: false
                });
                setTimeout(() => {
                    window.print();
                    window.close();
                }, 500);
            };
        </script>
    `);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
}
function calculateProfit() {
    const purchase = parseFloat(document.getElementById('purchase-price').value) || 0;
    const sale = parseFloat(document.getElementById('new-price').value) || 0;
    const profitDisplay = document.getElementById('profit-margin');

    if (purchase > 0 && sale > 0) {
        const profitPercent = ((sale - purchase) / purchase) * 100;
        profitDisplay.value = profitPercent.toFixed(1) + "%";
    }
}

function openPassModal() {
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('adminPassInput').focus();
}

function closePassModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('adminPassInput').value = ''; // مسح الحقل عند الإغلاق
}

function checkAdminPassword() {
    const enteredPass = document.getElementById('adminPassInput').value;
    const correctPass = "2004"; // ضع كلمة المرور الخاصة بك هنا

    if (enteredPass === correctPass) {
        window.location.href = "cashier.html";
    } else {
        alert("كلمة المرور خاطئة!");
        document.getElementById('adminPassInput').value = '';
    }
}

// السماح بالدخول عند الضغط على زر Enter في لوحة المفاتيح
document.getElementById('adminPassInput')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        checkAdminPassword();
    }
});
// دالة لجلب وعرض الجرد
async function loadInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">جاري ترتيب المخزن... <i class="fas fa-sort-amount-down-alt"></i></td></tr>';

    try {
        const snapshot = await db.collection("products").get();
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">لا توجد منتجات.</td></tr>';
            return;
        }

        // 1. تحويل البيانات إلى مصفوفة (Array) لسهولة ترتيبها
        let productsList = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            productsList.push({
                id: doc.id,
                ...data,
                stock: (data.stock !== undefined && data.stock !== null) ? data.stock : 0
            });
        });

        // 2. الترتيب من الأقل كمية إلى الأكثر كمية
        productsList.sort((a, b) => a.stock - b.stock);

        tbody.innerHTML = ''; // مسح رسالة التحميل

        // 3. عرض المنتجات المرتبة
        productsList.forEach(product => {
            const id = product.id;
            const stock = product.stock;
            
            const statusClass = stock <= 5 ? 'stock-low' : 'stock-ok';
            const statusText = stock <= 0 ? '❌ نافذ' : (stock <= 5 ? '📉 منخفض' : '✅ متوفر');

            const row = `
                <tr style="border-bottom: 1px solid #eee; background: ${stock <= 5 ? '#fff5f5' : 'transparent'};">
                    <td style="padding: 15px; font-weight: bold;">${product.name || 'بدون اسم'}</td>
                    <td style="padding: 15px; text-align: center;"><span class="${statusClass}">${stock}</span></td>
                    <td style="padding: 15px; text-align: center;">${statusText}</td>
                    <td style="padding: 15px; text-align: center;">
                        <div style="display: flex; gap: 5px; justify-content: center;">
                            <input type="number" id="add-qty-${id}" placeholder="+" style="width: 60px; padding: 6px; border-radius: 6px; border: 1px solid #ddd; text-align: center;">
                            <button onclick="updateStock('${id}', ${stock})" style="background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            tbody.insertAdjacentHTML('beforeend', row);
        });

    } catch (error) {
        console.error("Sorting Error:", error);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">خطأ في الترتيب: ${error.message}</td></tr>`;
    }
}
function searchInventory() {
    let input = document.getElementById('inventorySearch').value.toLowerCase();
    let table = document.getElementById('inventory-table-body');
    let rows = table.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        let nameCell = rows[i].getElementsByTagName('td')[0];
        if (nameCell) {
            let txtValue = nameCell.textContent || nameCell.innerText;
            rows[i].style.display = txtValue.toLowerCase().indexOf(input) > -1 ? "" : "none";
        }
    }
}

// دالة زيادة الكمية في المخزن
async function updateStock(productId, currentStock) {
    const input = document.getElementById(`add-qty-${productId}`);
    const addedValue = parseInt(input.value);

    if (isNaN(addedValue) || addedValue <= 0) {
        alert("يرجى إدخال كمية صحيحة");
        return;
    }

    try {
        const newStock = currentStock + addedValue;
        await db.collection("products").doc(productId).update({
            stock: newStock
        });
        alert("تم تحديث المخزن بنجاح");
        input.value = '';
        loadInventory(); // تحديث الجدول
    } catch (error) {
        alert("حدث خطأ أثناء التحديث");
    }
}

// تشغيل الجرد عند فتح الصفحة
loadInventory();
// تشغيل الجرد تلقائياً عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    loadInventory();
});
// دالة لتحديث سعر الصرف في قاعدة البيانات
// أضفها في نهاية الملف تماماً
async function updateGlobalExchangeRate(newRate) {
    if(!newRate) return;
    try {
        await db.collection("settings").doc("exchange_rate").set({
            value: parseInt(newRate),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        exchangeRate = parseInt(newRate);
        localStorage.setItem('exchangeRate', exchangeRate);
        alert("✅ تم تحديث سعر الصرف بنجاح");
        location.reload(); 
    } catch (error) {
        alert("❌ فشل التحديث");
    }
}
window.addEventListener('load', () => {
    loadProducts();      
    loadSavedCart();     
    checkFirstVisit();   
    
    // ربط الخانات بالتحويل فوراً
    document.getElementById('new-price')?.addEventListener('input', convertToLBP);
    document.getElementById('new-price-lbp')?.addEventListener('input', convertToUSD);
    document.getElementById('purchase-price')?.addEventListener('input', calculateProfit);
});
// --- أضف هذا الجزء لضمان عمل التحويل التلقائي عند الكتابة ---
document.addEventListener('DOMContentLoaded', () => {
    // ربط خانة الدولار لتغير الليرة والربح
    const usdIn = document.getElementById('new-price');
    if (usdIn) {
        usdIn.addEventListener('input', () => {
            convertToLBP();    // يحول لليرة فوراً
            calculateProfit(); // يحسب الربح فوراً
        });
    }

    // ربط خانة الليرة لتغير الدولار والربح
    const lbpIn = document.getElementById('new-price-lbp');
    if (lbpIn) {
        lbpIn.addEventListener('input', () => {
            convertToUSD();    // يحول للدولار فوراً
            calculateProfit(); // يحول الربح فوراً
        });
    }

    // ربط خانة سعر الشراء لتحديث الربح
    const purchaseIn = document.getElementById('purchase-price');
    if (purchaseIn) {
        purchaseIn.addEventListener('input', calculateProfit);
    }
});
// أضف هذا السطر في نهاية دالة checkMyPoints مثلاً
document.getElementById('points-result').scrollIntoView({ behavior: 'smooth', block: 'center' });