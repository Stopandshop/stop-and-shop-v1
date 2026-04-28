
window.onload = function() {
    updateShopStatus(); // تحديث حالة المتجر فوراً
    renderCartItems();  // تحديث السلة فوراً
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
    const filtered = (cleanCategory === 'الكل') ? products : products.filter(p => p.category.trim() === cleanCategory);
    displayProducts(filtered);
}

/// 6. نظام السلة
async function addToCart(productId) {
    // --- إضافة السطر التالي لجلب الكمية المختارة من الواجهة ---
    const qtyInput = document.getElementById(`qty-${productId}`);
    const chosenQuantity = qtyInput ? parseInt(qtyInput.value) : 1;

    // 1. البحث عن المنتج في القائمة الكبيرة
    const product = products.find(p => p.id === productId);
    
    if (product) {
        // --- فحص المخزن قبل الإضافة ---
        if (product.stock !== undefined && product.stock < chosenQuantity) {
            alert(`عذراً، المتوفر في المخزن هو ${product.stock} فقط!`);
            return;
        }

        // 2. التأكد من أن السلة مصفوفة
        if (!Array.isArray(cart)) cart = [];

        // 3. البحث إذا كان المنتج موجوداً مسبقاً في السلة
        const existingItem = cart.find(item => item.id === productId);

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
            await db.collection("products").doc(productId).update({
                stock: newStock,
                isOutOfStock: newStock <= 0
            });
            // تحديث القائمة المحلية لضمان مزامنة البيانات دون إعادة تحميل الصفحة
            product.stock = newStock;
            if (newStock <= 0) product.isOutOfStock = true;
        } catch (error) {
            console.error("خطأ في تحديث المخزن:", error);
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

    if (doc.exists) {
        // إضافة النقاط الجديدة للموجود سابقاً
        await userRef.update({
            points: firebase.firestore.FieldValue.increment(newPoints),
            lastOrder: firebase.firestore.FieldValue.serverTimestamp()
        });
    } else {
        // إنشاء سجل جديد للزبون لأول مرة
        await userRef.set({
            phone: phone,
            points: newPoints,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
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

        // حفظ الطلب في Firebase - نفس أسطرك الأصلية (أضفنا التاريخ والوقت والملاحظات)
        await db.collection("orders").add({
            orderId: orderId,
            customerPhone: customerPhone, // حفظ الرقم مع الطلب
            orderNotes: orderNotes,       // حفظ الملاحظات في قاعدة البيانات
            deliveryDate: deliveryDate,   // حفظ تاريخ التوصيل
            deliveryTime: deliveryTime,   // حفظ وقت التوصيل
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
        
        // --- إضافة: موعد التوصيل للرسالة ---
        msg += `📅 *موعد التوصيل:* ${deliveryDate} | ${deliveryTime}\n`;
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

        // ... الكود السابق الخاص بالرسالة والمتغيرات ...

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
            // التعديل هنا لضمان التوافق مع جميع المتصفحات
            setTimeout(() => {
                if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                    window.location.href = finalUrl; // استخدام href بدلاً من assign أحياناً يكون أضمن
                } else {
                    const newWindow = window.open(finalUrl, '_blank');
                    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
                        // في حال حظر المتصفح للنافذة، نستخدم الرابط المباشر في نفس الصفحة
                        window.location.href = finalUrl;
                    }
                }
            }, 500); // تأخير بسيط لنصف ثانية لضمان انتهاء عمليات Firebase
        }
        // --- نهاية التعديل ---

        // حفظ الطلب الأخير في ذاكرة المتصفح قبل مسحه
        localStorage.setItem('last_order', JSON.stringify(cart));

        // إظهار نافذة النجاح وتحديث رقم الطلب فيها
        const successIdDisplay = document.getElementById('success-order-id');
        if(successIdDisplay) successIdDisplay.innerText = "رقم الطلب: #" + orderId;
        
        const successModal = document.getElementById('success-modal');
        if(successModal) successModal.style.display = 'flex';

        // تفريغ السلة بعد نجاح الحفظ
        cart = [];
        updateCartCount();
        renderCartItems();
        updateRewardProgress();
        localStorage.removeItem('stop_shop_cart');
        
        // تفريغ حقول الإدخال أيضاً
        if (document.getElementById('order-notes')) document.getElementById('order-notes').value = "";
        if (document.getElementById('delivery-date')) document.getElementById('delivery-date').value = "";
        if (document.getElementById('delivery-time')) document.getElementById('delivery-time').value = "";

        // إرجاع نص الزر لحالته الطبيعية
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
async function saveProduct() {
    const id = document.getElementById('edit-product-id').value;
    const name = document.getElementById('new-name').value;
    const price = parseFloat(document.getElementById('new-price').value);
    const category = document.getElementById('new-category').value;
    const image = document.getElementById('new-image').value;
    // إضافة قيمة الـ checkbox الجديد
    const isOutOfStock = document.getElementById('out-of-stock-check').checked;
    
    // --- الإضافة الجديدة لجلب الباركود دون حذف أي سطر ---
    const barcode = document.getElementById('new-barcode').value.trim();

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
            alert("تم التعديل!");
        } else {
            await db.collection("products").add(data);
            alert("تمت الإضافة!");
        }
        resetForm();
    } catch (e) { alert("خطأ في Firebase: " + e.message); }
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
    
    // تأشير الـ checkbox بناءً على حالة المنتج
    document.getElementById('out-of-stock-check').checked = product.isOutOfStock || false;

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
    document.getElementById('new-barcode').value = "";
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