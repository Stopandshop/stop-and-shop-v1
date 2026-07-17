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
    loadLoyaltyCustomersRealtime();
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

// =========================================================
// متغيرات عالمية مضافة للتحكم بالعرض المجزأ ومنع تعليق الهواتف
// =========================================================
let displayedProductsCount = 50; 
let activeFilteredProducts = []; 

// 1. دالة loadProducts المحدثة للتزامن الكامل مع الحذف
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
        
        // 🛠️ الحل الجذري: عند أي تحديث حي من السيرفر (كالحذف)، نقوم بتحديث المصفوفة النشطة فوراً
        activeFilteredProducts = [...products];
        
        // إذا كان عدد المنتجات المعروضة أكبر من المتاح بعد الحذف، نضبطه على المتاح
        if (displayedProductsCount > activeFilteredProducts.length) {
            displayedProductsCount = Math.max(50, activeFilteredProducts.length);
        }
        
        // عرض المنتجات بناءً على العداد الحالي بدقة ليعكس الحذف فورا
        displayProducts(activeFilteredProducts.slice(0, displayedProductsCount));

        // إخفاء منطقة التحميل بعد ثانية واحدة من الاكتمال
        setTimeout(() => {
            if (loadingArea) loadingArea.style.display = 'none';
        }, 1500);

        // الحفاظ على الأسطر والوظائف الخاصة بك بالكامل داخل الـ Snapshot
        updateOffersBanner(products);
        
    }, (error) => {
        if (loadingText) loadingText.innerText = "❌ فشل التحميل، يرجى المحاولة لاحقاً";
        console.error(error);
    });
}

// 2. الدالة المحسنة لـ searchProducts (بدون حذف أي سطر منطقي وبأعلى سرعة)
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
    // 🔥 تأمين البحث: فرز النتيجة المفلترة فوراً ليظهر المنتج المستورد من الملف (الذي يملك باركود) بالصدارة أولاً
    filtered.sort((a, b) => {
        const aIsImported = a.barcode ? 1 : 0;
        const bIsImported = b.barcode ? 1 : 0;
       
        if (bIsImported !== aIsImported) {
            return bIsImported - aIsImported; // المرفوع من الملف أولاً
        }  
        // إذا تساويا في النوع، نرتب حسب الوقت الأحدث
        const aTime = a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds * 1000 : (typeof a.createdAt === 'number' ? a.createdAt : 0)) : 0;
        const bTime = b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds * 1000 : (typeof b.createdAt === 'number' ? b.createdAt : 0)) : 0;
        return bTime - aTime;
    });
   // 🛠️ تهيئة العداد للبحث الجديد وعرض النتائج مجزأة لتظل سريعة جداً
    displayedProductsCount = 50;
    activeFilteredProducts = [...filtered];   
    displayProducts(activeFilteredProducts.slice(0, displayedProductsCount));
}
// =========================================================
// 3. دالة الاستماع للتمرير (Scroll Listener) لزيادة المنتجات تلقائياً
// =========================================================
window.addEventListener('scroll', () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
        if (displayedProductsCount < activeFilteredProducts.length) {
            displayedProductsCount += 50; // زيادة 50 منتجاً إضافياً عند النزول لقاع الصفحة
            displayProducts(activeFilteredProducts.slice(0, displayedProductsCount));
        }
    }
});
// 5. دوال العرض والبحث (الإصلاح الجوهري هنا)
function displayProducts(productsList) {
    const container = document.getElementById('products-container');
    if (!container) return;
    container.innerHTML = ""; 

    // 🔥 التعديل القاتل والمضمون: فرز مصفوفة العرض المقدمة مباشرة لضمان الصدارة للملفات المستوردة
    const sortedProducts = [...productsList].sort((a, b) => {
        // فحص وجود حقل باركود للمنتج المرفوع من الملف
        const aIsImported = a.barcode ? 1 : 0;
        const bIsImported = b.barcode ? 1 : 0;
        
        // إذا كان أحدهما مرفوعاً من ملف والآخر يدوياً، يظهر المرفوع من الملف أولاً بالصدارة
        if (bIsImported !== aIsImported) {
            return bIsImported - aIsImported;
        }
        
        // إذا تساويا (كلاهما من ملف أو كلاهما يدوي)، نرتب تلقائياً حسب الوقت الأحدث لضمان التنظيم
        const aTime = a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds * 1000 : (typeof a.createdAt === 'number' ? a.createdAt : 0)) : 0;
        const bTime = b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds * 1000 : (typeof b.createdAt === 'number' ? b.createdAt : 0)) : 0;
        return bTime - aTime;
    });

    // القراءة والتحرك الآن يتم من المصفوفة المرتبة والمفرزة بالكامل sortedProducts
    sortedProducts.forEach(product => {
        const priceLBP = (parseFloat(product.price) || 0) * exchangeRate;
        
        // --- منطق الملصقات والمخزن الآمن ---
        const now = Date.now();
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        
        // معالجة ذكية جداً لتاريخ createdAt ليدعم جميع صيغ Firebase دون حدوث NaN أو تعليق
        let productTime = null;
        if (product.createdAt) {
            if (product.createdAt.seconds) {
                productTime = product.createdAt.seconds * 1000; // صيغة Firestore Timestamp
            } else if (typeof product.createdAt === 'number' || product.createdAt instanceof Date) {
                productTime = new Date(product.createdAt).getTime(); // صيغة رقمية أو كائن تاريخ
            }
        }
        
        // المنتج يعتبر جديد إذا كان تاريخه ضمن آخر 3 أيام، وفي حال لم يتوفر التاريخ بعد نعتبره جديداً طالما أنه مستورد من الملف حديثاً
        let isNew = false;
        if (productTime) {
            isNew = (now - productTime) < threeDays;
        } else if (product.barcode) {
            isNew = true; // حماية طوارئ: إذا رفعنا الملف وتأخر السيرفر في توليد الوقت، يظهر كجديد فوراً
        }
        
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
            // تظهر علامة جديد باللون المعتمد لديك لمدة 3 أيام
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

function filterByCategory(category, btn) {
    if(btn) {
        document.querySelectorAll('.categories button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    
    const cleanCategory = category.trim();
    
    // تعديل السطر ليكون أكثر مرونة في البحث
    let filtered = (cleanCategory === 'الكل') 
        ? products 
        : products.filter(p => p.category && p.category.toString().includes(cleanCategory));
        
    // 🔥 تأمين الأقسام: فرز النتيجة المفلترة فوراً ليقشر المنتج المستورد من الملف إلى المقدمة داخل القسم المحدد
    filtered.sort((a, b) => {
        const aIsImported = a.barcode ? 1 : 0;
        const bIsImported = b.barcode ? 1 : 0;
        
        if (bIsImported !== aIsImported) {
            return bIsImported - aIsImported; // المرفوع من الملف أولاً
        }
        
        // إذا تساويا في النوع، نرتب حسب الوقت الأحدث
        const aTime = a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds * 1000 : (typeof a.createdAt === 'number' ? a.createdAt : 0)) : 0;
        const bTime = b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds * 1000 : (typeof b.createdAt === 'number' ? b.createdAt : 0)) : 0;
        return bTime - aTime;
    });

    displayProducts(filtered);
}
/// 6. نظام السلة
async function addToCart(productId) {
    // --- إضافة السطر التالي لجلب الكمية المختارة من الواجهة ---
    const qtyInput = document.getElementById(`qty-${productId}`);
    const chosenQuantity = qtyInput ? parseInt(qtyInput.value) : 1;

    // --- [تعديل ذكي للباركود]: البحث عن المنتج سواء أرسلنا ID أو باركود ---
    let product = products.find(p => String(p.id) === String(productId) || String(p.barcode) === String(productId));
    
    if (product) {
        // تحديث الـ productId الحقيقي في حال تم العثور عليه عن طريق الباركود لضمان عمل العمليات التالية
        const realProductId = product.id;

        // الحل الجذري والأكيد: نحدد الاسم الفعلي للمستند في السيرفر ليتوافق تماماً مع آلية الحذف والتعديل
        const targetDocId = product.barcode ? product.barcode : realProductId;

        // 1. البحث عن المنتج في القائمة الكبيرة (موجود مسبقاً في السطر أعلاه)
        
        if (product) {
            // --- فحص المخزن قبل الإضافة ---
            if (product.stock !== undefined && product.stock < chosenQuantity) {
                alert(`عذراً، المتوفر في المخزن هو ${product.stock} فقط!`);
                return;
            }

            // 2. التأكد من أن السلة مصفوفة
            if (!Array.isArray(cart)) cart = [];

            // 3. البحث إذا كان المنتج موجوداً مسبقاً في السلة (نطابق بالـ id أو بالـ barcode لضمان عدم التكرار)
            const existingItem = cart.find(item => String(item.id) === String(realProductId) || (item.barcode && product.barcode && String(item.barcode) === String(product.barcode)));

            if (existingItem) {
                // --- تعديل السطر التالي ليضيف الكمية المختارة بدلاً من 1 فقط ---
                if (existingItem.quantity !== undefined) existingItem.quantity += chosenQuantity; 
                if (existingItem.qty !== undefined) existingItem.qty += chosenQuantity;
                if (existingItem.quantity === undefined) existingItem.quantity = (existingItem.qty || 1) + chosenQuantity;
            } else {
                // إضافة المنتج لأول مرة مع خاصية الكمية بالاسمين (quantity و qty) معاً لمنع تعليق كبسة الـ X والعدادات
                cart.push({ ...product, quantity: chosenQuantity, qty: chosenQuantity });
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
                // تم تعديل المستند هنا ليستخدم targetDocId المضمون والذكي
                await db.collection("products").doc(targetDocId).update({
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
        // توحيد قراءة حقل الكمية الذكي ليدعم التسميتين (quantity أو qty) لمنع تضارب المنتجات المرفوعة
        const currentQty = item.quantity || item.qty || 1;

        // حساب إجمالي السعر بناءً على الكمية المختارة
        const itemTotal = item.price * currentQty; 
        totalUsd += itemTotal;

        list.innerHTML += `
            <div class="cart-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                <div style="flex: 2;">
                    <span style="font-weight: bold;">${item.name}</span>
                    <div style="font-size: 0.8rem; color: #666;">
                        $${item.price.toFixed(2)} × ${currentQty}
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 5px; margin: 0 10px;">
                    <button onclick="changeQuantity(${index}, 1)" style="width:25px; height:25px; border-radius:50%; border:1px solid #ddd; background:white; cursor:pointer;">+</button>
                    <span style="min-width: 20px; text-align: center; font-weight: bold;">${currentQty}</span>
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
    // التحقق الذكي من الكمية لدعم التسميتين (quantity أو qty) لضمان التوافق التام
    const currentQty = cart[index].quantity !== undefined ? cart[index].quantity : (cart[index].qty || 1);

    if (currentQty + delta > 0) {
        if (cart[index].quantity !== undefined) cart[index].quantity += delta;
        if (cart[index].qty !== undefined) cart[index].qty += delta;
        
        // تأكيد تحديث التسميتين معاً لضمان عدم حدوث تضارب في أي مكان آخر
        if (cart[index].quantity === undefined) cart[index].quantity = currentQty + delta;
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
            
            // قراءة كمية الحذف بدقة سواء كانت مسجلة بـ quantity أو qty لمنع الـ NaN
            const qtyToRemove = itemToRemove.quantity !== undefined ? itemToRemove.quantity : (itemToRemove.qty || 1);

            // الحل الذكي: تحديد المعرف الفعلي الصحيح للمستند في الفايربيس (الباركود للمرفوع من الملف، أو الـ ID العادي)
            const targetDocId = itemToRemove.barcode ? itemToRemove.barcode : itemToRemove.id;
            
            // 2. تحديث المخزن في Firebase (الزيادة الحقيقية في السيرفر)
            // بما أنك تستخدم onSnapshot، فإن Firebase سيرسل التحديث الجديد للمصفوفة تلقائياً
            await db.collection("products").doc(targetDocId).update({
                stock: firebase.firestore.FieldValue.increment(qtyToRemove),
                isOutOfStock: false
            });

            // 3. تحديث مصفوفة المنتجات المحلية (products)
            // ملاحظة: قمنا بتعطيل العملية الحسابية هنا لأن onSnapshot سيقوم بجلب القيمة الصحيحة فوراً من Firebase
            const localProduct = products.find(p => String(p.id) === String(itemToRemove.id) || (p.barcode && itemToRemove.barcode && String(p.barcode) === String(itemToRemove.barcode)));
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
            if (typeof displayProducts === "function") {
                displayProducts(products); 
            } else if (typeof renderProducts === "function") {
                renderProducts(products);
            }

            console.log("تمت إعادة الكمية بدقة: تم استرجاع " + qtyToRemove);

        } catch (error) {
            console.error("خطأ أثناء الحذف:", error);
            
            // حل احتياطي طوارئ: إذا فشل تحديث السيرفر لأي سبب، نقوم بحذف العنصر محلياً من السلة لتستمر الواجهة بالعمل دون تعليق الكاشير
            cart.splice(index, 1);
            saveCartToStorage();
            updateCartCount();
            renderCartItems();
            updateRewardProgress();
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

        // 🛠️ الفحص الذكي لطريقة الدفع:
        if (payment === "عن طريق Whish Money") {
            // 1. إظهار المودال فوراً ليثبت على الشاشة ويظهر رقم المحفظة بوضوح دون تصفير السلة
            const modal = document.getElementById('whish-payment-modal');
            if(modal) modal.style.display = 'flex';
            
            const numDisplay = document.getElementById('whish-num-display');
            if(numDisplay) {
                const numberToCopy = numDisplay.innerText;
                navigator.clipboard.writeText(numberToCopy).catch(err => {
                    console.error("فشل النسخ التلقائي: ", err);
                });
            }

            // تعديل دالة زر الويش بداخل المودال ديناميكياً لتشمل التوجيه المباشر بعد الضغط والتصفير
            const whishBtn = document.querySelector('#whish-payment-modal button[onclick="processWhishAndOpen()"]');
            if (whishBtn) {
                whishBtn.setAttribute("onclick", `
                    // نسخ الرقم احتياطياً عند الضغط
                    const num = document.getElementById('whish-num-display') ? document.getElementById('whish-num-display').innerText : '81479786';
                    navigator.clipboard.writeText(num);
                    
                    // فتح تطبيق الويش
                    if (typeof processWhishAndOpen === "function") processWhishAndOpen();
                    
                    // تحويل الطلب فوراً إلى الواتساب
                    setTimeout(() => {
                        if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                            window.location.href = "${finalUrl}"; 
                        } else {
                            window.open("${finalUrl}", '_blank');
                        }
                    }, 1000);
                    
                    // إغلاق مودال الويش وإظهار النجاح والتنظيف
                    document.getElementById('whish-payment-modal').style.display = 'none';
                    const successModal = document.getElementById('success-modal');
                    if(successModal) successModal.style.display = 'flex';
                `);
            }

            // تصفير وتنظيف الحقول النصية فقط استعداداً للطلب القادم، مع إبقاء السلة لحين ضغط الزر
            localStorage.setItem('last_order', JSON.stringify(cart));
            const successIdDisplay = document.getElementById('success-order-id');
            if(successIdDisplay) successIdDisplay.innerText = "رقم الطلب: #" + orderId;

            setTimeout(() => {
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
            }, 500);

            return; // إيقاف تنفيذ الأسطر التالية لمنع الفتح التلقائي المتعارض!

        } else {
            // مسار الدفع العادي (نقداً عند التوصيل) يعمل تلقائياً كما كان تماماً
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
    // 🛠️ تم تعديل الترتيب: نقوم بنسخ الرقم المعروض أولاً لضمان بقائه في ذاكرة الهاتف قبل إخفاء الواجهة
    const numDisplay = document.getElementById('whish-num-display');
    if (numDisplay) {
        const numberToCopy = numDisplay.innerText;
        navigator.clipboard.writeText(numberToCopy).catch(err => {
            console.error("فشل النسخ: ", err);
        });
    }

    // إخفاء الواجهة (تم تأخيرها جزءاً من الثانية لضمان إتمام عمليات النسخ والقراءة بنجاح)
    setTimeout(function() {
        document.getElementById('whish-payment-modal').style.display = 'none';
    }, 300);

    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        // محاولة فتح التطبيق (🛠️ تم تصحيح الرابط إلى الرابط الرسمي المعتمد whishmoney:// ليفتح التطبيق فوراً)
        window.location.href = "whishmoney://";

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

// دالة حذف المنتج المحسنة والمعالجة لملفات الـ CSV المستوردة
async function deleteProduct(id) {
    if (confirm("هل أنت متأكد من حذف هذا المنتج نهائياً من قاعدة البيانات؟")) {
        try {
            // 1. البحث عن تفاصيل المنتج داخل المصفوفة المحلية
            const targetProduct = products.find(p => p.id === id);
            
            // تعيين معرّف افتراضي للمستند
            let docId = id;
            if (targetProduct && targetProduct.barcode) {
                docId = targetProduct.barcode;
            }

            console.log("محاولة أولى: الحذف المباشر للمستند باستخدام ID:", docId);
            
            // محاولة الحذف المباشر (للمنتجات التي تتطابق أسماؤها مع الباركود أو الـ ID)
            try {
                await db.collection("products").doc(String(docId)).delete();
            } catch (e) {
                console.log("المحاولة المباشرة لم تحذف من السيرفر، الانتقال للفحص العميق...");
            }

            // 🔥 الضربة القاضية (البحث الشرطي في السيرفر لضمان عدم العودة بعد التحديث):
            // إذا كان للمنتج باركود أو اسم، سنبحث عنه في السيرفر مباشرة لنجد المستند الحقيقي ونمسحه
            if (targetProduct) {
                let query = db.collection("products");
                let hasQuery = false;

                if (targetProduct.barcode && targetProduct.barcode.trim() !== "") {
                    query = query.where("barcode", "==", targetProduct.barcode.trim());
                    hasQuery = true;
                } else if (targetProduct.name && targetProduct.name.trim() !== "") {
                    query = query.where("name", "==", targetProduct.name.trim());
                    hasQuery = true;
                }

                if (hasQuery) {
                    const serverSnapshot = await query.get();
                    if (!serverSnapshot.empty) {
                        const batch = db.batch();
                        serverSnapshot.forEach(doc => {
                            console.log("تم العثور على المستند الحقيقي على السيرفر وحذفه:", doc.id);
                            batch.delete(doc.ref);
                        });
                        // تنفيذ الحذف الجماعي الفعلي على السيرفر
                        await batch.commit();
                    }
                }
            }

            // 2. التحديث الفوري للمصفوفات المحلية بداخل المتصفح (كودك الأصلي)
            products = products.filter(p => p.id !== id);
            if (typeof activeFilteredProducts !== 'undefined') {
                activeFilteredProducts = activeFilteredProducts.filter(p => p.id !== id);
            }
            
            // 3. إعادة رسم الشاشة بناءً على العداد الحالي (كودك الأصلي)
            if (typeof activeFilteredProducts !== 'undefined' && typeof displayedProductsCount !== 'undefined') {
                displayProducts(activeFilteredProducts.slice(0, displayedProductsCount));
            } else {
                displayProducts(products);
            }
            
            // 4. تحديث الإحصائيات لوحة التحكم إذا كنت المسؤول (كودك الأصلي)
            if (isAdmin && typeof updateDashboardStats === "function") {
                updateDashboardStats();
            }
            
            alert("تم حذف المنتج بنجاح وأبديّاً من قاعدة البيانات! 🗑️");
        } catch (error) {
            console.error("خطأ أثناء الحذف الصارم:", error);
            alert("فشل حذف المنتج من السيرفر: " + error.message);
        }
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

// 🔥 الدالة المحدثة لفتح النافذة المخفية بدلاً من الـ prompt دون حذف أكوادك الأصلية 🔥
function toggleAdmin() {
    const loginBtn = document.getElementById('login-btn');
    const dashboard = document.getElementById('admin-dashboard');
    
    if (isAdmin) {
        isAdmin = false;
        document.getElementById('add-product-form').style.display = 'none';
        dashboard.style.display = 'none'; 
        loginBtn.innerHTML = '<i class="fas fa-user"></i> دخول';
        
        // 🛠️ تعديل أمان وسرعة: إزالة أزرار "عرض المزيد" الخاصة بالمخزن عند الخروج لتخفيف الوزن
        const existingAdminBtn = document.getElementById('admin-load-more-btn');
        if (existingAdminBtn) existingAdminBtn.remove();
        
        // تفريغ محتوى جدول المخزن تماماً من الذاكرة لمنع ثقل المتصفح بعد الخروج
        const tbody = document.getElementById('inventory-table-body');
        if (tbody) tbody.innerHTML = '';

        // إعادة تصفير عداد الشاشة الرئيسية وعرض المنتجات بالتجزئة الآمنة (50 منتج فقط فورا)
        displayedProductsCount = 50;
        if (typeof activeFilteredProducts !== 'undefined' && activeFilteredProducts.length > 0) {
            displayProducts(activeFilteredProducts.slice(0, displayedProductsCount));
        } else {
            displayProducts(products.slice(0, displayedProductsCount));
        }
        return;
    }

    // بدلاً من الـ prompt، نقوم بإظهار النافذة المخفية الاحترافية
    document.getElementById('secure-password-modal').style.display = 'flex';
    document.getElementById('secure-admin-input').value = '';
    document.getElementById('secure-admin-input').focus();
}

// دالة إغلاق النافذة عند الضغط على إلغاء
function closeSecureModal() {
    document.getElementById('secure-password-modal').style.display = 'none';
}

// دالة التحقق والمعالجة (تضم كافة أكوادك الأصلية الحالية للتشفير والفايربيس والإحصائيات)
function submitSecureAdmin() {
    const loginBtn = document.getElementById('login-btn');
    const dashboard = document.getElementById('admin-dashboard');
    const password = document.getElementById('secure-admin-input').value;
    
    if (!password) return;

    // تشفير الكلمة التي تدخلها الآن للمقارنة (كودك الأصلي)
    const encodedPassword = btoa(password);
    
    // هذا هو الكود المشفر لكلمة bassam1632004 (كودك الأصلي)
    const storedHash = "YmFzc2FtMTYzMjAwNA==";

    if (encodedPassword === storedHash) {
        isAdmin = true;
        
        // إغلاق نافذة كلمة المرور بعد النجاح
        document.getElementById('secure-password-modal').style.display = 'none';
        
        document.getElementById('add-product-form').style.display = 'block';
        dashboard.style.display = 'block'; 
        loginBtn.innerHTML = '<i class="fas fa-user-shield"></i> خروج';
        
        // تفعيل الإشعارات والإحصائيات الأصلية الخاصة بك كاملة
        if ("Notification" in window) Notification.requestPermission();
        loadSalesStats(); 
        updateDashboardStats();
        
        // 🛠️ تعديل أمان وسرعة: تصفير عداد الواجهة الرئيسية عند الدخول وتطبيق التجزئة الذكية
        displayedProductsCount = 50;
        if (typeof adminDisplayedCount !== 'undefined') adminDisplayedCount = 50;

        if (typeof activeFilteredProducts !== 'undefined' && activeFilteredProducts.length > 0) {
            displayProducts(activeFilteredProducts.slice(0, displayedProductsCount));
        } else {
            activeFilteredProducts = [...products];
            displayProducts(activeFilteredProducts.slice(0, displayedProductsCount));
        }

        // تشغيل المخزن بالتجزئة السريعة 50 سطر فقط بدلاً من تعليق المتصفح
        if (typeof loadInventory === 'function') {
            loadInventory();
        }

        watchNewOrders();
        
        console.log("تم الدخول بنجاح");
    } else {
        alert("كلمة المرور خاطئة! تأكد من كتابة الأحرف الصغيرة.");
        document.getElementById('secure-admin-input').value = '';
        document.getElementById('secure-admin-input').focus();
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
    
    // تخزين معرف المستند الحالي لضمان الوصول إليه عند التحديث
    document.getElementById('edit-product-id').value = product.id;
    
    document.getElementById('new-name').value = product.name;
    document.getElementById('new-price').value = product.price;
    document.getElementById('new-category').value = product.category;
    document.getElementById('new-image').value = product.image;

    // مطابقة كاملة وحماية لحقول السوبرماركت الخاصة بك
    if (document.getElementById('new-barcode')) {
        document.getElementById('new-barcode').value = product.barcode || '';
    }
    if (document.getElementById('new-stock')) {
        document.getElementById('new-stock').value = product.stock || 0;
    }
    if (document.getElementById('product-cost-input')) {
        document.getElementById('product-cost-input').value = product.cost || 0;
    }

    // لتعبئة حقل الليرة اللبنانية فوراً عند الضغط على زر تعديل منتج بناءً على السعر الحالي
    if (document.getElementById('new-price-lbp')) {
        document.getElementById('new-price-lbp').value = product.priceLBP || Math.round((product.price * exchangeRate) / 500) * 500;
    }

    // جلب سعر الشراء بالليرة اللبنانية فوراً عند التعديل بناءً على التكلفة المتاحة
    if (document.getElementById('product-cost-lbp-input')) {
        const currentCost = product.cost || 0;
        document.getElementById('product-cost-lbp-input').value = currentCost > 0 ? Math.round(currentCost * exchangeRate) : '';
    }

    if (typeof calculateProfit === "function") calculateProfit();

    if (document.getElementById('out-of-stock-check')) {
        document.getElementById('out-of-stock-check').checked = product.isOutOfStock || false;
    }
    if (document.getElementById('product-old-price')) {
        document.getElementById('product-old-price').value = product.oldPrice || '';
    }
    
    document.getElementById('form-title').innerText = "تعديل: " + product.name;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('edit-product-id').value = "";
    document.getElementById('new-name').value = "";
    document.getElementById('new-price').value = "";
    document.getElementById('new-image').value = "";
    document.getElementById('new-barcode').value = "";
    document.getElementById('form-title').innerText = "إضافة منتج جديد";

    // تصفير الخانات بالمعرفات الحقيقية الموجودة في الـ HTML الخاص بك
    if(document.getElementById('product-cost-input')) document.getElementById('product-cost-input').value = ""; 
    if(document.getElementById('product-cost-lbp-input')) document.getElementById('product-cost-lbp-input').value = "";
    if(document.getElementById('new-price-lbp')) document.getElementById('new-price-lbp').value = "";
    if(document.getElementById('profit-margin')) document.getElementById('profit-margin').value = "0%";
    if(document.getElementById('new-stock')) document.getElementById('new-stock').value = "";
    if(document.getElementById('product-old-price')) document.getElementById('product-old-price').value = "";
    if(document.getElementById('out-of-stock-check')) document.getElementById('out-of-stock-check').checked = false;

    if(document.getElementById('profit-margin')) {
        document.getElementById('profit-margin').style.color = "#2e7d32";
    }

    document.getElementById('new-name').focus();
}

async function saveProduct() {
    // 1. جلب القيم من الـ HTML الفعلي لديك بدقة
    const id = document.getElementById('edit-product-id').value;
    const name = document.getElementById('new-name').value;
    const price = parseFloat(document.getElementById('new-price').value);
    const category = document.getElementById('new-category').value;
    const image = document.getElementById('new-image').value;
    
    const isOutOfStockCheck = document.getElementById('out-of-stock-check');
    const isOutOfStock = isOutOfStockCheck ? isOutOfStockCheck.checked : false;
    
    const barcodeInput = document.getElementById('new-barcode');
    const barcode = barcodeInput ? barcodeInput.value.trim() : ""; 

    const stockInput = document.getElementById('new-stock');
    const stock = stockInput ? parseInt(stockInput.value) : 0;

    const oldPriceInput = document.getElementById('product-old-price');
    const oldPrice = oldPriceInput && oldPriceInput.value ? parseFloat(oldPriceInput.value) : null;
    
    const costPriceInput = document.getElementById('product-cost-input');
    const costPrice = costPriceInput ? (parseFloat(costPriceInput.value) || 0) : 0;

    const priceLBPInput = document.getElementById('new-price-lbp');
    const priceLBP = priceLBPInput && priceLBPInput.value ? parseFloat(priceLBPInput.value.replace(/,/g, '')) : Math.round((price * exchangeRate) / 500) * 500;

    if (!name || isNaN(price) || !image) return alert("أكمل البيانات!");

    if (typeof calculateProfit === "function") calculateProfit();

    // نحدد اسم المستند (Doc ID): إن وجد باركود نعتمد عليه كـ ID، وإلا نستخدم الـ ID الافتراضي للمنتج
    const targetDocId = barcode ? barcode : (id ? id : `product_${Date.now()}`);

    const data = { 
        name, 
        price, 
        priceLBP,      
        cost: costPrice, 
        category, 
        image, 
        barcode, 
        isOutOfStock: isOutOfStock || (stock <= 0), 
        stock, 
        oldPrice: oldPrice, 
        lastUpdated: Date.now() 
    };

    // 🔍 تأمين ملصق الجديد: البحث عن المنتج الحالي في المصفوفة لجلب تاريخ إنشائه الأصلي إن وجد
    const existingProduct = products.find(p => p.id === id);

    if (!id) {
        // في حالة إضافة منتج جديد كلياً لأول مرة
        data.createdAt = Date.now();
        data.id = targetDocId.replace('product_', '');
    } else {
        // في حالة التعديل: إذا كان للمنتج تاريخ إنشاء أصلي مخزن، نحافظ عليه ونرسله لمنع اختفاء ملصق "جديد"
        if (existingProduct && existingProduct.createdAt) {
            data.createdAt = existingProduct.createdAt;
        }
    }

    try {
        // إذا كنا نقوم بعملية تعديل لمنتج موجود اصلاً
        if (id) {
            // إذا قام المستخدم بتعديل رقم الباركود وأصبح مختلفاً عن الـ ID القديم المخزن
            if (id !== targetDocId) {
                // ننشئ المستند الجديد بالباركود الجديد ونحفظ به كامل البيانات المحدثة مع تاريخ الإنشاء الأصلي
                await db.collection("products").doc(targetDocId).set(data, { merge: true });
                // نحذف المستند القديم لضمان عدم بقاء المنتج القديم مكرراً في النظام بالباركود القديم
                await db.collection("products").doc(id).delete().catch(e => console.log("المستند القديم تم حذفه أو غير موجود"));
            } else {
                // إذا لم يتغير الباركود، نقوم بتحديث نفس المستند مباشرة بـ set merge لحماية البيانات المرفوعة
                await db.collection("products").doc(id).set(data, { merge: true });
            }
            alert("تم تحديث بيانات المنتج بنجاح! ✅");
        } else {
            // في حالة إضافة منتج جديد كلياً
            await db.collection("products").doc(targetDocId).set(data, { merge: true });
            alert("تمت إضافة المنتج الجديد بنجاح! ✨");
        }

        // تشغيل وظائف الطباعة التلقائية المتوافقة مع أجهزة الـ Xprinter لديك
        if (typeof printProductLabel === "function") {
            printProductLabel({ name, price, barcode });
        } else if (typeof printBarcode === "function") {
            printBarcode(barcode, name, price); 
        }

        // تنظيف وتصفير الفورم بعد نجاح الإرسال
        if (typeof resetForm === "function") resetForm();

        // إخفاء الـ Modal أو الفورم التابع للـ Admin تلقائياً لمنع التشتيت عند العمل المباشر
        const modal = document.querySelector('.modal') || 
                      document.getElementById('edit-modal') || 
                      document.getElementById('product-modal') ||
                      document.getElementById('unified-modal') ||
                      document.getElementById('add-product-form') ||
                      document.querySelector('[style*="display: block"]');

        if (modal && modal.id !== 'add-product-form') {
            modal.style.display = 'none';
        }

    } catch (e) {
        console.error("Firebase Error:", e);
        alert("خطأ تقني أثناء الحفظ: " + e.message);
    }
}

// 8. الطباعة والعودة للأعلى
function printInvoice(printWindow) {
    if (cart.length === 0) return alert("السلة فارغة، لا يوجد ما يمكن طباعته!");

    // إذا لم يتم تمرير نافذة مفتوحة مسبقاً (مثلاً لو ضغطت على زر طباعة مباشر)، يتم فتح نافذة جديدة هنا تلقائياً
    if (!printWindow) {
        printWindow = window.open('', '_blank');
    }

    // 🛠️ الإصلاح الذكي والمقاوم للأرشيف والكاشير معاً:
    // إذا كانت قيم الواجهة حية وموجودة نعتمدها، وإذا كنا نطبع من الأرشيف نقوم بحسابها تلقائياً بالاعتماد على السلة الحالية
    let totalUsdVal = 0;
    cart.forEach(item => { totalUsdVal += (parseFloat(item.price) * parseInt(item.quantity)); });

    const totalUsdEl = document.getElementById('total-usd');
    const totalLbpEl = document.getElementById('total-lbp');
    
    const totalUsd = totalUsdEl ? totalUsdEl.innerText : totalUsdVal.toFixed(2);
    const totalLbp = totalLbpEl ? totalLbpEl.innerText : (Math.round((totalUsdVal * exchangeRate) / 500) * 500).toLocaleString();
    
    const paymentChoiceEl = document.getElementById('payment-choice');
    const paymentMethod = paymentChoiceEl ? paymentChoiceEl.value : "نقداً";
    const date = new Date().toLocaleString('ar-LB');
    const points = Math.floor(parseFloat(totalUsd) / 5); // نظام النقاط الخاص بك

    // --- أمر فتح صندوق الكاشير التلقائي (Esc/POS Command) ---
    // هذا الكود يرسل نبضة كهربائية عبر منفذ الطابعة الحرارية RJ11 ليفتح الصندوق فوراً قبل بدء خروج ورقة الفاتورة
    const openDrawerCommand = String.fromCharCode(27, 112, 48, 55, 121);

    let invoiceContent = `
        <div dir="rtl" style="font-family: 'Tajawal', sans-serif; padding: 30px; border: 1px solid #eee; width: 380px; margin: auto; color: #333; background: #fff;">
            
            <span style="display:none;">${openDrawerCommand}</span>

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
        // 🛠️ حساب السعر اللبناني للمنتج الحالي لطباعته بأسلوب منسق ومريح للعين بجانب الدولار
        const itemPriceUSD = parseFloat(item.price) || 0;
        const itemTotalUSD = itemPriceUSD * parseInt(item.quantity);
        
        // استخراج القيمة اللبنانية المخزنة للمنتج أو حسابها حياً من السيرفر وتدويرها لأقرب 500 ليرة
        const itemTotalLBP = item.priceLBP ? (item.priceLBP * parseInt(item.quantity)) : (Math.round((itemTotalUSD * exchangeRate) / 500) * 500);

        invoiceContent += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0; font-size: 14px; line-height: 1.4;">
                    <b>${item.name}</b>
                </td>
                <td style="text-align: center; padding: 10px 0;">${item.quantity}</td>
                <td style="text-align: left; padding: 10px 0; font-weight: bold; font-size: 13px; line-height: 1.4;">
                    <span style="color: #c0392b;">$${itemTotalUSD.toFixed(2)}</span>
                    <br>
                    <small style="color: #555; font-weight: normal; font-size: 11px;">(${itemTotalLBP.toLocaleString()} ل.ل)</small>
                </td>
            </tr>
        `;
    });

    invoiceContent += `
                </tbody>
            </table>

            <div style="border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; text-align: left; line-height: 1.8;">
                <div style="display: flex; justify-content: space-between; font-size: 16px;">
                    <span>المجموع بالدولار:</span>
                    <span style="font-weight: bold; color: #c0392b;">$${totalUsd.replace('$', '').trim()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 16px; margin-bottom: 10px;">
                    <span>المجموع باللبناني:</span>
                    <span style="font-weight: bold;">${totalLbp.replace('L.L', '').replace('ل.ل', '').trim()} L.L</span>
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

    // استخدام النافذة المفتوحة مسبقاً بدلاً من فتح واحدة جديدة
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
    loadLoyaltyCustomersRealtime(); 
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
function loadSalesHistory() {
    // 1. جلب البيانات مع الترتيب التلقائي حسب التاريخ الأقرب (الأحدث أولاً)
    db.collection("orders")
      .orderBy("timestamp", "desc") // ترتيب تنازلي بناءً على التوقيت المخزن في الفايربيز
      .limit(50)
      .onSnapshot(snapshot => {
        
        const ordersTable = document.getElementById('ordersTable') || document.getElementById('admin-orders-list');
        if (!ordersTable) {
            console.error("خطأ: لم يتم العثور على عنصر الجدول في الـ HTML");
            return;
        }
        
        let salesBody = ordersTable.getElementsByTagName('tbody')[0];
        if (!salesBody) {
            salesBody = ordersTable;
        }
        
        salesBody.innerHTML = ''; // تفريغ الجدول بأمان لبنائه من جديد

        if (snapshot.empty) {
            salesBody.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align: center; color: #2c3e50 !important;">لا يوجد فواتير مسجلة حالياً</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const order = doc.data();
            const rawId = doc.id; // المعرف الفريد للمستند للحذف والطباعة
            
            // قراءة حقل orderId الفعلي من داخل بيانات الفاتورة
            const displayOrderId = order.orderId || order.id || rawId;
            
            // قراءة وتحويل التاريخ للعمود الثالث
            let orderDate = 'غير محدد';
            if (order.date) {
                if (typeof order.date.toDate === 'function') {
                    orderDate = order.date.toDate().toLocaleString('ar-EG', { 
                        year: 'numeric', 
                        month: 'numeric', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else {
                    orderDate = order.date;
                }
            }
            
            // قراءة حقل المبلغ
            let total = 0;
            if (order.total !== undefined) {
                total = parseFloat(order.total) || 0;
            } else if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    total += parseFloat(item.cost) || 0;
                });
            }

            // بناء السطر مع إضافة زر الحذف بجانب زر الطباعة في حقل التحكم
            salesBody.innerHTML += `
                <tr class="order-row" data-id="${rawId}" style="display: table-row !important;">
                    <td style="padding: 10px; color: #2c3e50 !important; font-weight: bold; text-align: center;">${displayOrderId}</td>
                    <td class="total-cell" style="padding: 10px; color: #e74c3c !important; font-weight: bold; text-align: center;">$ ${total.toFixed(2)}</td>
                    <td style="padding: 10px; color: #2c3e50 !important; font-weight: bold; text-align: center; direction: ltr;">${orderDate}</td>
                    <td style="padding: 10px; text-align: center;">
                        <button onclick="printArchiveOrder('${rawId}')" style="background: #34495e; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-left: 5px;">
                            <i class="fas fa-print"></i> طباعة
                        </button>
                        <button onclick="deleteOrder('${rawId}', '${displayOrderId}')" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-trash-alt"></i> حذف
                        </button>
                    </td>
                </tr>
            `;
        });
        
        if (typeof updateReports === "function") {
            updateReports();
        }
    }, error => {
        console.error("خطأ أثناء جلب الفواتير من Firebase: ", error);
        
        // إذا ظهر خطأ الفهرسة (Index) في الـ Console، نقوم بالجلب بدونOrderBy كحماية احتياطية
        fallbackLoadSalesHistory();
    });
}

// 2. دالة الحذف الذكية والأمنة المسؤولة عن زر الحذف الجديد
function deleteOrder(documentId, orderNo) {
    if (confirm(`هل أنت متأكد تماماً من رغبتك في حذف الفاتورة رقم (${orderNo}) نهائياً من النظام؟`)) {
        db.collection("orders").doc(documentId).delete().then(() => {
            alert(`تم حذف الفاتورة ${orderNo} بنجاح من قاعدة البيانات.`);
        }).catch((error) => {
            console.error("خطأ أثناء محاولة حذف المستند: ", error);
            alert("عذراً، فشل حذف الفاتورة. تحقق من الصلاحيات.");
        });
    }
}

// دالة حماية احتياطية في حال لم تكن قد قمت بتفعيل الـ Index في حساب فايربيز الخاص بك بعد
function fallbackLoadSalesHistory() {
    db.collection("orders").limit(50).onSnapshot(snapshot => {
        const ordersTable = document.getElementById('ordersTable') || document.getElementById('admin-orders-list');
        let salesBody = ordersTable.getElementsByTagName('tbody')[0] || ordersTable;
        salesBody.innerHTML = '';
        
        let localOrders = [];
        snapshot.forEach(doc => {
            localOrders.push({ id: doc.id, data: doc.data() });
        });

        // ترتيب مصفوفة البيانات يدوياً بالأكواد للـ timestamp الأحدث
        localOrders.sort((a, b) => {
            let tA = a.data.timestamp ? (a.data.timestamp.seconds || 0) : 0;
            let tB = b.data.timestamp ? (b.data.timestamp.seconds || 0) : 0;
            return tB - tA;
        });

        localOrders.forEach(item => {
            const order = item.data;
            const rawId = item.id;
            const displayOrderId = order.orderId || order.id || rawId;
            let orderDate = order.date ? (typeof order.date.toDate === 'function' ? order.date.toDate().toLocaleString('ar-EG') : order.date) : 'غير محدد';
            let total = order.total !== undefined ? parseFloat(order.total) : 0;

            salesBody.innerHTML += `
                <tr class="order-row" data-id="${rawId}">
                    <td style="padding: 10px; color: #2c3e50 !important; font-weight: bold; text-align: center;">${displayOrderId}</td>
                    <td style="padding: 10px; color: #e74c3c !important; font-weight: bold; text-align: center;">$ ${total.toFixed(2)}</td>
                    <td style="padding: 10px; color: #2c3e50 !important; font-weight: bold; text-align: center; direction: ltr;">${orderDate}</td>
                    <td style="padding: 10px; text-align: center;">
                        <button onclick="printArchiveOrder('${rawId}')" style="background: #34495e; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-left: 5px;">
                            <i class="fas fa-print"></i> طباعة
                        </button>
                        <button onclick="deleteOrder('${rawId}', '${displayOrderId}')" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-trash-alt"></i> حذف
                        </button>
                    </td>
                </tr>
            `;
        });
    });
}
// 2. دالة وسيطة للطباعة (تستخدم دالتك الأصلية printInvoice)
function printArchiveOrder(orderId) {
    // جلب بيانات الفاتورة المحددة بدقة من السحاب لطباعتها فوراً
    db.collection("orders").doc(orderId).get().then(doc => {
        if (doc.exists) {
            const orderData = doc.data();
            
            // حفظ السلة الحالية للزبون مؤقتاً لكي لا تضيع
            const tempCart = [...cart]; 
            
            // تأمين وتخزين نصوص المجموع الحالية في الكاشير قبل استبدالها
            const totalPriceEl = document.getElementById('totalPrice');
            const finalPriceEl = document.getElementById('finalPrice'); // في حال وجود خصومات
            const tempTotalText = totalPriceEl ? totalPriceEl.innerText : "";
            const tempFinalText = finalPriceEl ? finalPriceEl.innerText : "";

            // 🛠️ التحديث الذكي للّبناني: نقوم بتهيئة أسعار المواد بداخل السلة لتشمل السعر اللبناني بجانب كل منتج عند الطباعة
            if (orderData.items && Array.isArray(orderData.items)) {
                cart = orderData.items.map(item => {
                    // حساب سعر القطعة بالليرة اللبنانية بناءً على السعر المحفوظ بالدولار وسعر الصرف
                    const itemPriceUSD = parseFloat(item.price) || 0;
                    const itemPriceLBP = item.priceLBP ? item.priceLBP : (Math.round((itemPriceUSD * exchangeRate) / 500) * 500);
                    
                    // نقوم بالتعديل على اسم المنتج أو النص المخصص للطباعة ليعرض السعر بالعملتين معاً داخل الجدول
                    return {
                        ...item,
                        // إضافة السعر اللبناني منسقاً بجانب الاسم أو كخاصية تقرأها دالة الطباعة الخاصة بك
                        displayPriceLBP: itemPriceLBP.toLocaleString() + " ل.ل"
                    };
                });
            } else {
                cart = orderData.items; 
            }

            // الإصلاح السحري: حقن المجموع الإجمالي المخزن بالفاتورة الأصلية داخل حقول الواجهة فوراً ليقرأها أمر الطباعة بدقة
            if (totalPriceEl && orderData.totalPrice !== undefined) {
                totalPriceEl.innerText = parseFloat(orderData.totalPrice).toFixed(2) + " $";
            }
            if (finalPriceEl && orderData.finalPrice !== undefined) {
                finalPriceEl.innerText = parseFloat(orderData.finalPrice).toFixed(2) + " $";
            } else if (totalPriceEl && orderData.totalPrice !== undefined && finalPriceEl) {
                finalPriceEl.innerText = parseFloat(orderData.totalPrice).toFixed(2) + " $";
            }
            
            // استدعاء دالة الطباعة الخاصة بك الموجودة في الكود
            if (typeof printInvoice === "function") {
                printInvoice(); 
            } else {
                alert("دالة printInvoice غير معرفة في هذا القسم");
            }
            
            // إعادة سلة الزبون الحالية كما كانت بعد انتهاء الطباعة
            cart = tempCart;

            // إعادة الحسابات الأصلية للكاشير النشط لكي لا تختلط حسابات الزبون الحالي مع الفاتورة المطبوعة
            if (totalPriceEl) totalPriceEl.innerText = tempTotalText;
            if (finalPriceEl) finalPriceEl.innerText = tempFinalText;

        } else {
            alert("تعذر العثور على الفاتورة لطباعتها");
        }
    }).catch(err => {
        console.error("خطأ في جلب بيانات الطباعة:", err);
    });
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
    let selectedDate = document.getElementById("dateFilter").value; // الصيغة القادمة من الفلتر YYYY-MM-DD
    let table = document.getElementById("ordersTable");
    if (!table) return;
    
    let tr = table.getElementsByTagName("tr");

    // دالة داخلية ذكية لتحويل الأرقام الإنجليزية إلى أرقام هندسية/عربية لضمان المطابقة
    const toArabicDigits = (str) => {
        return String(str).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
    };

    let filterYear = "", filterMonth = "", filterDay = "";
    let filterYearAr = "", filterMonthAr = "", filterDayAr = "";

    if (selectedDate !== "") {
        let parts = selectedDate.split("-");
        if (parts.length === 3) {
            filterYear = parts[0];
            filterMonth = String(parseInt(parts[1], 10)); // الشهر بدون أصفار حشو
            filterDay = String(parseInt(parts[2], 10));   // اليوم بدون أصفار حشو

            // تحويلهم للأرقام الهندية المقابلة
            filterYearAr = toArabicDigits(filterYear);
            filterMonthAr = toArabicDigits(filterMonth);
            filterDayAr = toArabicDigits(filterDay);
        }
    }

    for (let i = 1; i < tr.length; i++) {
        let tds = tr[i].getElementsByTagName("td");
        
        // حماية برمجية: تخطي الأسطر الفارغة أو أسطر المجموع النهائي لضمان عدم حدوث خطأ
        if (!tds || tds.length < 3 || tr[i].innerText.includes("المجموع النهائي")) {
            continue;
        }

        // 1. فحص مطابقة رقم الطلب (في العمود الأول index 0)
        let idText = (tds[0].textContent || tds[0].innerText).toUpperCase();
        let matchesSearch = idText.indexOf(searchText) > -1;

        // 2. فحص مطابقة التاريخ (في العمود الثالث index 2)
        let matchesDate = true;
        if (selectedDate !== "" && tds[2]) {
            let rowDate = tds[2].textContent || tds[2].innerText;
            
            // فحص ذكي يبحث عن السنة والشهر واليوم بالصيغتين (العربية والإنجليزية) داخل نص الخلية
            let includesYear = rowDate.includes(filterYear) || rowDate.includes(filterYearAr);
            let includesMonth = rowDate.includes("/" + filterMonth + "/") || rowDate.includes("/" + filterMonthAr + "/") || 
                                rowDate.includes(" " + filterMonth + " ") || rowDate.includes(" " + filterMonthAr + " ") ||
                                rowDate.includes(filterMonth) || rowDate.includes(filterMonthAr);
            let includesDay = rowDate.includes(filterDay) || rowDate.includes(filterDayAr);

            matchesDate = (includesYear && includesMonth && includesDay);
        }

        // إظهار السطر فقط إذا تطابق البحث مع التاريخ معاً
        if (matchesSearch && matchesDate) {
            tr[i].style.display = "";
        } else {
            tr[i].style.display = "none";
        }
    }

    // الحفاظ الكامل على دالة تحديث التقارير الأصلية الخاصة بك دون أي تعديل أو حذف
    if (typeof updateReports === "function") {
        updateReports();
    }
}

// إعادة ضبط الفلاتر لإظهار كل الطلبات
function resetFilters() {
    document.getElementById("orderSearch").value = "";
    document.getElementById("dateFilter").value = "";
    filterOrders();
}
function updateReports() {
    let table = document.getElementById("ordersTable");
    if (!table) return;
    
    let tr = table.getElementsByTagName("tr");
    
    let totalUSD = 0;
    let orderCount = 0;
    
    // 🛠️ تعديل ذكي: جعل سعر الصرف يقرأ القيمة الحية من متجرك (exchangeRate) بدلاً من التثبيت على 89000
    const rate = (typeof exchangeRate !== 'undefined') ? exchangeRate : 89000; 

    for (let i = 1; i < tr.length; i++) {
        // نحسب فقط الصفوف الظاهرة (التي اجتازت الفلتر)
        if (tr[i].style.display !== "none") {
            let tds = tr[i].getElementsByTagName("td");
            if (tds && tds[1]) {
                let priceText = tds[1].innerText; // عمود المبلغ
                let price = parseFloat(priceText.replace('$', '').trim());
                
                if (!isNaN(price)) {
                    totalUSD += price;
                    orderCount++;
                }
            }
        }
    }

    // تحديث الأرقام في الواجهة بحماية برمجية (في حال كانت العناصر غير موجودة بالشاشة الحالية)
    const elCount = document.getElementById("report-order-count");
    const elUsd = document.getElementById("report-total-usd");
    const elLbp = document.getElementById("report-total-lbp");

    if (elCount) elCount.innerText = orderCount;
    if (elUsd) elUsd.innerText = totalUSD.toFixed(2) + " $";
    if (elLbp) elLbp.innerText = (totalUSD * rate).toLocaleString() + " ل.ل";
}

// فصل دالة الـ Load بشكل مستقل تماماً لمنع تداخل الأقواس وحل المشكلة (أكوادك الأصلية بالكامل)
window.addEventListener('load', () => {
    // --- تسجيل الـ Service Worker ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker: Registered ✅'))
        .catch(err => console.log('Service Worker: Error ❌', err));
    }

    // --- الدوال الأصلية الخاصة بك المجمعة بانتظام ---
    if (typeof loadProducts === "function") loadProducts();      // جلب المنتجات
    if (typeof loadSavedCart === "function") loadSavedCart();     // استرجاع السلة
    if (typeof checkFirstVisit === "function") checkFirstVisit();   // فحص الترحيب
    if (typeof loadSalesStats === "function") loadSalesStats();    // تحميل إحصائيات المبيعات
    
    // تشغيل دالة جلب فواتير الأرشيف فور فتح الصفحة لتظهر مباشرة للعين
    loadSalesHistory();

    // تنبيه مخصص لمستخدمي الأيفون (لأن Safari لا يدعم التثبيت التلقائي)
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.navigator.standalone;
    if (isIos) {
        setTimeout(() => {
            alert("للوصول السريع: اضغط على زر 'مشاركة' (Share) أسفل المتصفح ثم اختر 'إضافة إلى الشاشة الرئيسية' (Add to Home Screen) 📲");
        }, 6000);
    }
});

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    // منع المتصفح من إظهار التنبيه الافتراضي فوراً
    e.preventDefault();
    deferredPrompt = e;

    // إظهار رسالة مخصصة للزبون بعد 3 ثوانٍ من دخول الموقع
    setTimeout(() => {
        if (typeof showInstallBanner === "function") showInstallBanner();
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
let html5QrCode = null; 
let isScannerCooldown = false; // قفل لمنع تكرار القراءة السريعة واختفاء المنتج

// 1. دالة تشغيل السكنر المباشرة والمطابقة تماماً لنسخة مكتبتك
function startScanner() {
    const wrapper = document.getElementById('scanner-wrapper');
    if (wrapper) wrapper.style.display = 'flex';

    isScannerCooldown = false; // فتح قفل الأمان عند تشغيل السكنر

    // تهيئة السكنر وتعديل بناء الكائن برمجياً ليقوم بفتح الكاميرا فوراً دون طلب أزرار داخلية
    if (!html5QrCode) {
        try {
            // التعديل التقني هنا: استخدام Html5Qrcode للتشغيل المباشر بدلاً من الواجهة الجاهزة القديمة
            html5QrCode = new Html5Qrcode("reader"); 
            
            const config = { 
                fps: 15, // سرعة لقطة عالية لتناسب حركة المنتجات في السوبرماركت
                qrbox: { width: 250, height: 150 }
            };

            // تشغيل الكاميرا الخلفية مباشرة فور الضغط على الزر دون أزرار طلب صلاحية داخلية
            html5QrCode.start(
                { facingMode: "environment" }, 
                config, 
                onScanSuccess, 
                (error) => {
                    // تجاوز أخطاء مسح الصور المتتالية أثناء حركة الكاميرا الطبيعية
                }
            ).catch(err => {
                console.error("خطأ أثناء تشغيل محرك الكاميرا المباشر:", err);
                // إظهار تنبيه للمستخدم في حال فتح الملف عبر الـ file://
                alert("تنبيه: المتصفح يمنع الكاميرا من ملف محلي. يرجى رفع الموقع على استضافة https أو تشغيل سيرفر محلي (Localhost).");
            });

        } catch (e) {
            console.error("خطأ أثناء تشغيل محرك الكاميرا المباشر:", e);
        }
    }
}

// دالة معالجة الباركود المقروء بنجاح
function onScanSuccess(decodedText) {
    // إذا كانت واجهة الكاميرا مخفية أو قفل الأمان مفعل، يتجاهل القراءة فوراً
    const wrapper = document.getElementById('scanner-wrapper');
    if (!wrapper || wrapper.style.display === 'none' || isScannerCooldown) return;
    
    isScannerCooldown = true; // تفعيل القفل لمنع التكرار اللحظي

    // وضع الرقم المقروء في خانة البحث فوراً
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = decodedText;
        // تشغيل دالة البحث الأصلية في مشروعك لتحديث المنتجات خلف الكاميرا فوراً
        if (typeof searchProducts === "function") {
            searchProducts();
        }
    }
    
    console.log("تم قراءة الباركود بنجاح:", decodedText);

    // البحث عن المنتج داخل مصفوفة المنتجات الأصلية لديك
    const foundProduct = products.find(p => 
        p.barcode && String(p.barcode).trim() === String(decodedText).trim()
    );

    if (foundProduct) {
        closeScanner(); // إغلاق واجهة الكاميرا فوراً وبطريقة آمنة
        showProductSticker(foundProduct); // عرض الملصق المنبثق الذكي لحماية المنتجات الخلفية
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } else {
        // إذا كان الباركود غير مسجل، يفتح القفل بعد ثانيتين لتجربة منتج آخر دون إغلاق الكاميرا
        setTimeout(() => {
            isScannerCooldown = false;
        }, 2000);
    }
}

// 2. دالة رسم الملصق المنبثق لحماية واجهة المنتجات الخلفية من الحذف والاختفاء
function showProductSticker(product) {
    const audio = new Audio('https://www.soundjay.com/buttons/beep-07a.mp3');
    audio.play().catch(e => console.log("الصوت يحتاج تفاعل أولاً"));

    let stickerModal = document.getElementById('scanned-sticker-modal');
    if (!stickerModal) {
        stickerModal = document.createElement('div');
        stickerModal.id = 'scanned-sticker-modal';
        stickerModal.style.cssText = "display:flex; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:99999; justify-content:center; align-items:center;";
        document.body.appendChild(stickerModal);
    }

    stickerModal.style.display = 'flex';
    
    stickerModal.innerHTML = `
        <div class="scanned-product-result" style="max-width: 280px; width:90%; padding: 20px; border: 2px solid #27ae60; border-radius: 15px; text-align: center; background: white; box-shadow: 0 5px 25px rgba(0,0,0,0.2); direction: rtl; font-family: 'Tajawal', sans-serif;">
            <div class="sticker-header" style="font-size: 0.95rem; color: #27ae60; font-weight: bold; margin-bottom: 10px;">
                <i class="fas fa-check-circle"></i> تم التعرف على المنتج
            </div>
            
            <img src="${product.image || 'https://cdn-icons-png.flaticon.com/512/679/679821.png'}" alt="${product.name}" style="width: 90px; height: 90px; object-fit: contain; margin-bottom: 10px;">
            
            <div class="sticker-info">
                <h3 style="font-size: 1.1rem; margin: 5px 0; color:#2c3e50;">${product.name}</h3>
                <span class="sticker-category" style="font-size: 0.8rem; color: #7f8c8d; display:block; margin-bottom: 8px;">${product.category || 'عام'}</span>
                <div class="sticker-price" style="font-size: 1.5rem; font-weight: bold; color: #e74c3c; margin-bottom: 15px;">$${product.price.toFixed(2)}</div>
            </div>

            <div class="sticker-actions" style="display:flex; flex-direction:column; gap:8px;">
                <button class="add-btn-large" onclick="addToCart('${product.id}'); document.getElementById('scanned-sticker-modal').style.display='none';" style="background: #27ae60; color: white; border: none; padding: 10px; font-size: 0.95rem; width: 100%; border-radius: 20px; cursor: pointer; font-weight:bold;">
                    <i class="fas fa-cart-plus"></i> إضافة للسلة
                </button>
                
                <button class="close-sticker" onclick="document.getElementById('scanned-sticker-modal').style.display='none';" style="font-size: 0.85rem; padding: 5px; background: none; border: none; color: #e74c3c; cursor: pointer; font-weight:bold; text-decoration:underline;">
                    <i class="fas fa-times"></i> إغلاق النافذة
                </button>
            </div>
        </div>
    `;
}

// 3. دالة الإغلاق الحقيقية والآمنة والمطابقة لزر الإغلاق الأحمر لإنهاء بث الكاميرا برمجياً بدون أخطاء
function closeScanner() {
    // إيقاف بث الكاميرا الحركي رسمياً كـ Promise لضمان إطفاء العدسة والكشاف أولاً وبأمان تام
    if (html5QrCode && typeof html5QrCode.stop === "function") {
        html5QrCode.stop().then(() => {
            console.log("تم إيقاف بث الكاميرا بنجاح.");
            const wrapper = document.getElementById('scanner-wrapper');
            if (wrapper) wrapper.style.display = 'none'; // إخفاء الواجهة الرمادية بعد الإيقاف المضمون
            html5QrCode = null; // تصفير الكائن ليكون جاهزاً لإعادة البناء عند الطلب التالي مباشرة
        }).catch((err) => {
            console.log("إشعار إغلاق احتياطي للواجهة:", err);
            const wrapper = document.getElementById('scanner-wrapper');
            if (wrapper) wrapper.style.display = 'none';
            html5QrCode = null;
        });
    } else {
        const wrapper = document.getElementById('scanner-wrapper');
        if (wrapper) wrapper.style.display = 'none';
    }
    
    isScannerCooldown = false; // تصفير قفل الأمان لتصبح جاهزة للمرة القادمة تماماً
}

// دالة تفريغ احتياطية لضمان التوافق الكامل مع أي استدعاء قديم بملفك
function stopScanner() {
    closeScanner();
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
window.hideManualAddForm = function() { 
    const modal = document.getElementById('manual-points-modal');
    if (modal) {
        modal.style.display = 'none'; 
    } else {
        console.error("لم يتم العثور على عنصر يحمل الـ ID: manual-points-modal");
    }
};
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
        if(bannerSection) bannerSection.style.display = 'block';
        if(slider) {
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
        }
    } else {
        if(bannerSection) bannerSection.style.display = 'none';
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
        let waitHours = (hour < openingHour) ? (openingHour - hour) : (24 - hour + openingHour);
        statusText.innerText = `مغلق الآن ❌ (يفتح بعد ${waitHours} ساعة)`;
        
        statusText.style.color = "#e74c3c"; // أحمر واضح
        
        body.style.transition = "all 0.5s ease"; // انتقال ناعم للألوان
        body.style.backgroundColor = "#f4f4f4"; // خلفية رمادية فاتحة
    }
}

// تشغيل الدالة عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', updateShopStatus);

// تحديث الحالة كل دقيقة
setInterval(updateShopStatus, 60000);

function repeatLastOrder() {
    const lastOrder = localStorage.getItem('last_order');
    if (lastOrder) {
        cart = JSON.parse(lastOrder);
        if(typeof updateCartCount === "function") updateCartCount();
        if(typeof renderCartItems === "function") renderCartItems();
        if(typeof updateRewardProgress === "function") updateRewardProgress();
        alert("تمت إضافة منتجات آخر طلب إلى سلتك!");
    } else {
        alert("لا يوجد طلبات سابقة مسجلة.");
    }
}

function closeSuccessModal() {
    const modal = document.getElementById('success-modal');
    if(modal) modal.style.display = 'none';
    location.reload(); 
}

async function checkMyPoints() {
    const phoneInput = document.getElementById('check-phone-input');
    const resultDiv = document.getElementById('points-result');

    if (!phoneInput || !phoneInput.value.trim()) {
        alert("يرجى إدخال رقم الهاتف أولاً!");
        return;
    }

    const phone = phoneInput.value.trim();
    resultDiv.style.color = "#2c3e50"; 
    resultDiv.innerText = "جاري الفحص... ⏳";

    try {
        const userRef = db.collection("users").doc(phone);
        const doc = await userRef.get();

        if (doc.exists) {
            const userData = doc.data();
            const totalPoints = userData.points || 0;
            
            resultDiv.style.color = "#27ae60"; 
            resultDiv.innerHTML = `رصيدك الحالي هو: <span style="font-size: 28px;">${totalPoints}</span> نقطة 🏆`;
        } else {
            resultDiv.style.color = "#e74c3c"; 
            resultDiv.innerText = "هذا الرقم غير مسجل في نظام النقاط لدينا.";
        }

        // نقل السطر إلى هنا ليعمل تلقائياً وبأمان فور ظهور النتيجة للزبون
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

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
        if(status) status.innerText = "متصفحك لا يدعم تحديد الموقع.";
        return;
    }

    if(status) status.innerText = "جاري تحديد موقعك... ⏳";

    navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;
        if(locationUrlInput) locationUrlInput.value = mapLink;
        
        if(status) {
            status.style.color = "#27ae60";
            status.innerText = "✅ تم تحديد الموقع بنجاح!";
        }
        if(addressInput) addressInput.value = "تم تحديد الموقع عبر الخريطة 📍";
    }, (error) => {
        if(status) {
            status.style.color = "#e74c3c";
            status.innerText = "فشل التحديد: يرجى إعطاء الإذن للموقع.";
        }
    });
}

function updateStatus(msg, isError) {
    const statusEl = document.getElementById('status-msg');
    if (statusEl) {
        statusEl.innerText = msg;
        statusEl.style.display = 'block';
        statusEl.style.color = isError ? 'red' : 'green';
    } else {
        alert(msg);
    }
}

async function loadTodaySales() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const staffSnapshot = await db.collection("staff").get();
    const activeStaff = [];
    staffSnapshot.forEach(doc => {
        const sData = doc.data();
        activeStaff.push(sData.name || sData.staff);
    });

    // تم التعديل الجوهري للتوجيه إلى كولكشن المبيعات الفعلي "sales" وحقل التوقيت "time"
    db.collection("sales")
        .where("time", ">=", startOfDay)
        .onSnapshot(snapshot => {
            let totalUSD = 0;
            let ordersCount = snapshot.size;
            let staffStats = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                // قراءة حقل المبلغ الصحيح (totalUSD) أو المبلغ البديل المتاح في المستند
                const saleAmount = parseFloat(data.totalUSD) || parseFloat(data.total) || 0;
                const employee = data.employee || "مدير الصالة";

                totalUSD += saleAmount;

                // التعديل الذكي: نجمع ونعرض الموظف سواء كان مسجلاً في الـ staff أو باشر البيع مباشرة
                if (activeStaff.includes(employee) || employee) {
                    if (!staffStats[employee]) {
                        staffStats[employee] = { count: 0, total: 0 };
                    }
                    staffStats[employee].count += 1;
                    staffStats[employee].total += saleAmount;
                }
            });

            const totalUsdEl = document.getElementById('today-total-usd');
            const ordersCountEl = document.getElementById('today-orders-count');
            if(totalUsdEl) totalUsdEl.innerText = "$ " + totalUSD.toFixed(2);
            if(ordersCountEl) ordersCountEl.innerText = ordersCount;

            const tableBody = document.getElementById('staff-performance-body');
            if(tableBody) {
                tableBody.innerHTML = '';
                for (const [name, stats] of Object.entries(staffStats)) {
                    tableBody.innerHTML += `
                        <tr>
                            <td style="font-weight: bold; color: #2c3e50;">${name}</td>
                            <td>${stats.count} فاتورة</td>
                            <td class="total-cell" style="font-weight: bold; color: #27ae60;">${stats.total.toFixed(2)} $</td>
                            <td style="text-align: center;">
                                <button onclick="deleteStaffMember('${name}')" 
                                        style="background: #ff5252; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-family: 'Segoe UI'; font-weight: bold;">
                                    حذف الموظف
                                </button>
                            </td>
                        </tr>
                    `;
                }
            }
            
            // استدعاء دالة تحديث وعرض الأرشيف لكي تظهر الأسطر فوراً داخل الجدول الفارغ في الصورة
            if (typeof loadSalesHistory === "function") {
                loadSalesHistory();
            }
        });
}

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
            location.reload(); 

        } catch (error) {
            alert("حدث خطأ: " + error.message);
        }
    }
}

async function addNewStaff() {
    const nameInput = document.getElementById('new-staff-name');
    const pinInput = document.getElementById('new-staff-pin');
    
    if(!nameInput || !pinInput) return;

    const name = nameInput.value.trim();
    const pin = pinInput.value.trim();

    if (name === "" || pin === "") {
        alert("يرجى إدخال الاسم وكلمة المرور!");
        return;
    }

    try {
        // الحفظ في كولكشن staff مع إضافة حقل username لتأمين قراءته في القائمة العلوية
        await db.collection("staff").add({
            name: name,
            username: name, /* 🔥 السر هنا: هذا الحقل الذي تبحث عنه القائمة المنسدلة لتعرض الاسم */
            pin: pin, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("تم حفظ الموظف " + name + " بنجاح ✅");
        nameInput.value = "";
        pinInput.value = "";
        
        if(typeof loadTodaySales === "function") loadTodaySales();
        
        // 🔄 إعادة تنشيط الصفحة تلقائياً بعد ثانية واحدة لكي تقرأ القائمة المنسدلة الاسم الجديد فوراً
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
    } catch (error) {
        alert("خطأ: " + error.message);
    }
}
// دالة ذكية لعرض الموظفين داخل الجدول بشكل تلقائي ومستمر
// 1. دالة العرض المحدثة لتوليد زر الحذف لكل موظف تلقائياً
function listenToStaffChanges() {
    if (typeof db !== "undefined" && document.getElementById('staff-table-body')) {
        db.collection("staff").orderBy("createdAt", "desc").onSnapshot(snapshot => {
            const tableBody = document.getElementById('staff-table-body');
            let rowsHtml = "";
            
            if (snapshot.empty) {
                tableBody.innerHTML = `<tr><td colspan="3" style="padding: 15px; text-align: center; color: #999;">لا يوجد موظفين مسجلين حالياً</td></tr>`;
                return;
            }

            snapshot.forEach(doc => {
                const staff = doc.data();
                const docId = doc.id; // الحصول على معرف المستند الفرعي للحذف
                const displayName = staff.name || staff.username || "بدون اسم";
                const displayPin = staff.pin || "****";
                
                rowsHtml += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px; font-weight: bold; color: #333;">${displayName}</td>
                        <td style="padding: 12px; color: #666; font-family: monospace;">${displayPin}</td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="deleteStaff('${docId}', '${displayName}')" 
                                    style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.8rem; transition: 0.2s;">
                                <i class="fa fa-trash"></i> حذف
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            tableBody.innerHTML = rowsHtml;
        }, error => {
            console.error("خطأ أثناء جلب الموظفين للجدول:", error);
        });
    }
}

// 2. 🔥 دالة الحذف الذكية من قاعدة البيانات مباشرة 🔥
async function deleteStaff(docId, staffName) {
    if (confirm(`هل أنت متأكد من حذف الموظف (${staffName}) نهائياً؟`)) {
        try {
            await db.collection("staff").doc(docId).delete();
            alert(`تم حذف الموظف ${staffName} بنجاح 🗑️`);
        } catch (error) {
            alert("خطأ أثناء الحذف: " + error.message);
        }
    }
}

// تشغيل التلقائي عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", listenToStaffChanges);
if (document.readyState === "complete" || document.readyState === "interactive") {
    listenToStaffChanges();
}
async function resetTodaySales() {
    if (confirm("هل أنت متأكد من تصفير مبيعات اليوم؟ لا يمكن التراجع عن هذه الخطوة!")) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        try {
            // تحويل التاريخ إلى صيغة طابع زمني رسمي لـ Firebase لضمان دقة استعلام الفلتر
            const firebaseQueryDate = firebase.firestore.Timestamp.fromDate(startOfDay);
            
            // الاستعلام الصحيح والمباشر من كولكشن sales وحقل time
            const snapshot = await db.collection("sales").where("time", ">=", firebaseQueryDate).get();

            if (snapshot.empty) {
                alert("العدادات صفر بالفعل!");
                return;
            }

            // معالجة ذكية لحماية الـ Batch من تخطي حاجز الـ 500 مستند
            let batch = db.batch();
            let count = 0;
            const promises = [];

            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                count++;

                if (count === 400) {
                    promises.push(batch.commit());
                    batch = db.batch();
                    count = 0;
                }
            });

            if (count > 0) {
                promises.push(batch.commit());
            }

            await Promise.all(promises);

            alert("تم تصفير العدادات بنجاح. ابدأ يومك بالرزق الحلال! ✅");
            location.reload(); 

        } catch (error) {
            alert("حدث خطأ أثناء التصفير: " + error.message);
        }
    }
}


function convertToLBP() {
    const usdInput = document.getElementById('new-price'); 
    const lbpInput = document.getElementById('new-price-lbp');
    if (usdInput && lbpInput) {
        const val = parseFloat(usdInput.value) || 0;
        lbpInput.value = Math.round((val * exchangeRate) / 500) * 500;
        if(typeof calculateProfit === "function") calculateProfit(); 
    }
}

function convertToUSD() {
    const usdInput = document.getElementById('new-price');
    const lbpInput = document.getElementById('new-price-lbp');
    if (usdInput && lbpInput && exchangeRate > 0) {
        const val = parseFloat(lbpInput.value) || 0;
        usdInput.value = (val / exchangeRate).toFixed(2);
        if(typeof calculateProfit === "function") calculateProfit();
    }
}

function displayCurrentRate() {
    const rateElement = document.getElementById('admin-rate-display');
    if (rateElement) {
        // تصحيح: تم تغيير rate إلى exchangeRate ليتوافق مع كودك
        rateElement.innerText = "سعر الصرف الحالي: " + exchangeRate.toLocaleString() + " L.L";
    }
}

window.onload = function() {
    displayCurrentRate();
    if(typeof updateShopStatus === "function") updateShopStatus(); 
    if(typeof renderCartItems === "function") renderCartItems();  
};

function updateGlobalRate() {
    // تصحيح: استخدام exchangeRate بدلاً من rate لمنع التضارب
    let newRate = prompt("أدخل سعر صرف التسعير (للإدارة - مثلاً 90000):", exchangeRate);
    let newSellingRate = prompt("أدخل سعر صرف البيع (للزبون - مثلاً 89000):", localStorage.getItem('sellingRate') || 89000);
    
    if (newRate !== null && newRate !== "" && !isNaN(newRate)) {
        exchangeRate = parseFloat(newRate); // تم التعديل هنا
        
        localStorage.setItem('exchangeRate', exchangeRate);
        
        if (newSellingRate !== null && newSellingRate !== "" && !isNaN(newSellingRate)) {
            localStorage.setItem('sellingRate', parseFloat(newSellingRate));
        }
        
        const rateDisplay = document.getElementById('admin-rate-display');
        if (rateDisplay) {
            rateDisplay.innerText = exchangeRate.toLocaleString() + " L.L";
        }

        const usdInput = document.getElementById('new-price');
        const lbpInput = document.getElementById('new-price-lbp');

        // التحقق من وجود الحقول في الصفحة قبل التشغيل لمنع توقف الكود
        if (usdInput && lbpInput) {
            if (usdInput.value !== "") {
                convertToLBP(); 
            } else if (lbpInput.value !== "") {
                convertToUSD();
            }
        }
        
        alert("تم تحديث الأسعار بنجاح ✅\nالتسعير: " + exchangeRate + " | البيع: " + newSellingRate);
    }
}

window.addEventListener('load', () => {
    let savedRate = localStorage.getItem('exchangeRate');
    if (savedRate) {
        exchangeRate = parseFloat(savedRate); 
        
        const rateDisplay = document.getElementById('admin-rate-display');
        if (rateDisplay) {
            rateDisplay.innerText = exchangeRate.toLocaleString() + " L.L";
        }
    }
});

function printProductLabel() {
    const nameEl = document.getElementById('new-name');
    const priceLBPEl = document.getElementById('new-price-lbp');
    const barcodeEl = document.getElementById('new-barcode');

    if(!nameEl || !barcodeEl) return;

    const name = nameEl.value;
    const priceLBP = priceLBPEl ? priceLBPEl.value : "0";
    const barcode = barcodeEl.value;

    if (!name || !barcode) {
        alert("يرجى إدخال اسم المنتج والباركود أولاً!");
        return;
    }

    // بناء محتوى الملصق بالتصميم المحسن والأنيق بالكامل
    const labelHTML = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>Print Label</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
            /* إعدادات الملصق الصغير 40x30 مم لقسم الطباعة */
            @page { 
                size: 40mm 30mm; 
                margin: 0; 
            }
            
            body {
                margin: 0; padding: 0;
                display: flex; 
                justify-content: center;
                align-items: center;
                font-family: 'Arial', sans-serif;
                background-color: #fff;
            }

            /* الملصق الموحد بمقاسات دقيقة وطباعة دقيقة جداً */
            .sticker {
                width: 40mm;
                height: 30mm;
                background: white;
                box-sizing: border-box;
                padding: 1.5mm 1.5mm 1mm 1.5mm;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                overflow: hidden;
                text-align: center;
            }

            .prod-name {
                font-size: 10pt;
                font-weight: 900;
                line-height: 1.1;
                margin: 0;
                height: 8mm;
                display: flex;
                align-items: center;
                justify-content: center;
                word-break: break-all;
                color: #000;
            }

            /* حاوية السعر اللبناني الاحترافية باللون الأسود */
            .price-container {
                background: #000 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color: #fff;
                padding: 1.2mm 0;
                border-radius: 1mm;
                margin: 0.5mm 0;
            }

            .price-lbp {
                font-size: 14pt;
                font-weight: 900;
                display: block;
            }
            
            .currency { font-size: 7pt; }

            .barcode-section {
                width: 100%;
                height: 10mm;
                display: flex;
                justify-content: center;
                align-items: center;
                margin-top: 0.5mm;
            }
            
            #barcode { 
                width: 100%; 
                height: 100%; 
            }

            .footer {
                font-size: 6.5pt;
                font-weight: bold;
                border-top: 0.3pt solid #000;
                padding-top: 0.5mm;
                color: #000;
            }

            @media print {
                body { background: none; }
                .sticker { border: none; }
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        </style>
    </head>
    <body>

        <div class="sticker">
            <div class="prod-name">${name}</div>

            <div class="price-container">
                <span class="price-lbp">${parseInt(priceLBP).toLocaleString()} <small class="currency">ل.ل</small></span>
            </div>

            <div class="barcode-section">
                <svg id="barcode"></svg>
            </div>

            <div class="footer">Stop & Shop</div>
        </div>

        <script>
            window.onload = function() {
                // توليد الباركود بدقة عالية وخيارات مخصصة للمقاس الصغير
                JsBarcode("#barcode", "${barcode}", {
                    format: "CODE128",
                    width: 1.8,       /* سُمك الخطوط لضمان دقة القراءة بالماسح */
                    height: 35,       /* طول متناسق مع المقاس */
                    displayValue: true, /* إظهار الأرقام أسفل القضبان */
                    fontSize: 10,     /* حجم خط الأرقام لتظل واضحة */
                    fontOptions: "bold",
                    margin: 0
                });
                
                // بدء الطباعة الفورية بمجرد اكتمال الرسم
                setTimeout(() => {
                    window.print();
                    window.close();
                }, 400);
            };
        <\/script>
    </body>
    </html>
    `;

    // فتح النافذة المخصصة للطباعة وإرسال الأكواد إليها
    const printWindow = window.open('', '_blank', 'width=450,height=400');
    printWindow.document.write(labelHTML);
    printWindow.document.close();
}
function calculateProfit() {
    const purchaseInput = document.getElementById('product-cost-input') || document.getElementById('purchase-price');
    const saleInput = document.getElementById('new-price');
    const profitDisplay = document.getElementById('profit-margin');

    // 🛠️ تأمين إضافي: جلب حقل سعر الشراء بالليرة الجديد لمنع حدوث تداخل أثناء الحساب اللحظي
    const purchaseLbpInput = document.getElementById('product-cost-lbp-input');

    if(!purchaseInput || !saleInput || !profitDisplay) return;

    // قراءة القيم وتحويلها إلى أرقام عشرية (كودك الأصلي)
    const purchase = parseFloat(purchaseInput.value) || 0;
    const sale = parseFloat(saleInput.value) || 0;

    // إذا كان سعر الشراء بالدولار صفراً ولكن يوجد قيمة في حقل الليرة، نقوم بحساب النسبة بناءً عليها منعاً للـ NaN
    let finalPurchase = purchase;
    if (finalPurchase === 0 && purchaseLbpInput && typeof exchangeRate !== 'undefined') {
        const purchaseLbp = parseFloat(purchaseLbpInput.value) || 0;
        if (purchaseLbp > 0) {
            finalPurchase = purchaseLbp / exchangeRate;
        }
    }

    // تطبيق الشرط الخاص بك تماماً باستخدام القيمة المحققة آلياً
    if (finalPurchase > 0 && sale > 0) {
        // معادلتك الحسابية الأصلية بالكامل
        const profitPercent = ((sale - finalPurchase) / finalPurchase) * 100;
        
        // طباعة النسبة وتلوينها بدقة صارمة (أكواد الألوان والـ % الخاصة بك بالكامل)
        profitDisplay.value = profitPercent.toFixed(1) + "%";
        profitDisplay.style.color = profitPercent >= 0 ? "#2e7d32" : "#d32f2f";
    } else {
        // الحفاظ على حالة التصفير الأصلية لديك
        profitDisplay.value = "0%";
        profitDisplay.style.color = "#388e3c"; // الحفاظ على اللون الأخضر الافتراضي للنسبة الصفرية
    }
}

function openPassModal() {
    const modal = document.getElementById('passwordModal');
    const input = document.getElementById('adminPassInput');
    if(modal) modal.style.display = 'flex';
    if(input) input.focus();
}

function closePassModal() {
    const modal = document.getElementById('passwordModal');
    const input = document.getElementById('adminPassInput');
    if(modal) modal.style.display = 'none';
    if(input) input.value = ''; 
}

function checkAdminPassword() {
    const input = document.getElementById('adminPassInput');
    if(!input) return;
    const enteredPass = input.value;
    const correctPass = "2004"; 

    if (enteredPass === correctPass) {
        window.location.href = "cashier.html";
    } else {
        alert("كلمة المرور خاطئة!");
        input.value = '';
    }
}

document.getElementById('adminPassInput')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        checkAdminPassword();
    }
});

// =========================================================
// متغيرات عالمية مضافة للتحكم بالعرض السريع بصفحة الـ Admin
// =========================================================
let adminDisplayedCount = 50; // عرض 50 منتجاً فقط كدفعة أولى لمنع التعليق
let adminOriginalProducts = []; // حفظ نسخة من كافة بضائع المستودع للبحث السريع
let adminFilteredProducts = []; // حفظ نسخة للبضائع التي تمت تصفيتها

// 1. دالة جلب وترتيب بضائع المخزن المحسنة (صاروخية ولا تعلق)
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

        let productsList = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            productsList.push({
                id: doc.id,
                ...data,
                stock: (data.stock !== undefined && data.stock !== null) ? data.stock : 0
            });
        });

        // ترتيب المنتجات حسب النواقص لتظهر في الصدارة
        productsList.sort((a, b) => a.stock - b.stock);

        // الحفاظ على المتغيرات العالمية للتحكم السريع
        adminOriginalProducts = [...productsList];
        adminFilteredProducts = [...productsList];
        adminDisplayedCount = 50; // تصفير العداد عند كل تحميل جديد

        // استدعاء الدالة الفرعية لرسم الجدول مجزأً
        renderInventoryTable();

    } catch (error) {
        console.error("Sorting Error:", error);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">خطأ في الترتيب: ${error.message}</td></tr>`;
    }
}

// 2. دالة فرعية تم عزلها لرسم أسطر الجدول بالتجزئة الذكية (بدون حذف أي منطق خاص بك)
function renderInventoryTable() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    tbody.innerHTML = ''; 

    // أخذ الشريحة المطلوبة فقط بناءً على العداد الحالي (50، 100، 150...)
    const sliceToDisplay = adminFilteredProducts.slice(0, adminDisplayedCount);

    if (sliceToDisplay.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#999;">لم يتم العثور على نتائج مطابقة للبحث.</td></tr>';
        removeAdminMoreBtn();
        return;
    }

    sliceToDisplay.forEach(product => {
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

    // التحكم بظهور وإخفاء زر "عرض المزيد" بأسفل الجدول تلقائياً
    handleAdminMoreButton();
}

// 3. دالة البحث الاحترافية السريعة جداً (تبحث في الذاكرة بدلاً من تعليق العناصر)
function searchInventory() {
    let input = document.getElementById('inventorySearch').value.toLowerCase().trim();
    
    // البحث الفوري في المصفوفة الأصلية المخزنة بالذاكرة 
    adminFilteredProducts = adminOriginalProducts.filter(product => {
        const name = (product.name || "").toLowerCase();
        const barcode = (product.barcode || "").toLowerCase();
        const cat = (product.category || "").toLowerCase();
        return name.includes(input) || barcode === input || cat.includes(input);
    });

    // عند البحث نقوم بإعادة تصفير عداد المشاهدة لعرض أول 50 نتيجة مطابقة بسرعة فائقة
    adminDisplayedCount = 50;
    renderInventoryTable();
}

// 4. دالة إدارة زر "عرض المزيد" المضافة لحماية الشاشة

async function updateStock(productId, currentStock) {
    const input = document.getElementById(`add-qty-${productId}`);
    if(!input) return;
    const addedValue = parseInt(input.value);

    if (isNaN(addedValue) || addedValue <= 0) {
        alert("يرجى إدخال كمية صحيحة");
        return;
    }

    try {
        const newStock = currentStock + addedValue;
        
        // 1. الحفظ الذكي والآمن في الفايربيس (كودك المحدث)
        await db.collection("products").doc(productId).update({
            stock: firebase.firestore.FieldValue.increment(addedValue)
        });
        
        // 🛠️ التحديث الذكي: تحديث القيمة داخل المصفوفات المحلية فوراً
        if (typeof adminOriginalProducts !== 'undefined') {
            let p1 = adminOriginalProducts.find(p => p.id === productId);
            if (p1) p1.stock = newStock;
            // 🎯 إعادة ترتيب المصفوفة الأصلية لتصعد الكميات الأقل والنواقص للأعلى دائماً
            adminOriginalProducts.sort((a, b) => a.stock - b.stock);
        }
        if (typeof adminFilteredProducts !== 'undefined') {
            let p2 = adminFilteredProducts.find(p => p.id === productId);
            if (p2) p2.stock = newStock;
            // 🎯 إعادة ترتيب مصفوفة التصفية (البحث) لضمان استقرار الترتيب بالكمية
            adminFilteredProducts.sort((a, b) => a.stock - b.stock);
        }
        
        alert("تم تحديث المخزن بنجاح");
        
        // 🛠️ الإصلاح السحري: تصفير قيمة الخانة في الواجهة أولاً قبل إعادة بناء الجدول
        input.value = '';
        
        // 2. تحديث المخزن وإعادة رسم الجدول بالكميات والترتيب الجديد حياً
        if (typeof renderInventoryTable === 'function') {
            renderInventoryTable();
        } else {
            loadInventory(); 
        }
        
    } catch (error) {
        alert("حدث خطأ أثناء التحديث");
    }
}
function handleAdminMoreButton() {
    removeAdminMoreBtn(); // مسح القديم أولاً لمنع التكرار

    if (adminDisplayedCount < adminFilteredProducts.length) {
        const table = document.querySelector('.inventory-container') || document.getElementById('inventory-table-body').parentElement;
        const btn = document.createElement('button');
        btn.id = 'admin-load-more-btn';
        btn.innerHTML = `<i class="fas fa-plus-circle"></i> عرض المزيد من المنتجات (${adminFilteredProducts.length - adminDisplayedCount} صنف متبقي)`;
        btn.style = "width: 94%; margin: 15px 3%; padding: 12px; background: #e74c3c; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Tajawal', sans-serif; display: block; text-align: center;";
        
        btn.onclick = function() {
            adminDisplayedCount += 50; // زيادة 50 منتجاً إضافياً عند الضغط
            renderInventoryTable();
        };
        table.after(btn);
    }
}

function removeAdminMoreBtn() {
    const existingBtn = document.getElementById('admin-load-more-btn');
    if (existingBtn) existingBtn.remove();
}
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

// تشغيل المستمعات والتحميلات بأمان لجميع الصفحات
// تشغيل المستمعات والتحميلات بأمان لجميع الصفحات
document.addEventListener('DOMContentLoaded', () => {
    loadInventory();
    
    document.getElementById('new-price')?.addEventListener('input', convertToLBP);
    document.getElementById('new-price-lbp')?.addEventListener('input', convertToUSD);
    document.getElementById('purchase-price')?.addEventListener('input', calculateProfit);
    document.getElementById('product-cost-input')?.addEventListener('input', calculateProfit);

    const usdIn = document.getElementById('new-price');
    if (usdIn) {
        usdIn.addEventListener('input', () => {
            // تصفير حقل نسبة العرض الخاص تلقائياً
            const specialOfferInput = document.getElementById('special-offer-percentage');
            if (specialOfferInput) specialOfferInput.value = "";

            // تصفير حقل السعر قبل العرض (اختياري) تلقائياً
            const oldPriceInput = document.getElementById('product-old-price');
            if (oldPriceInput) oldPriceInput.value = "";

            convertToLBP();    
            calculateProfit(); 
        });
    }

    const lbpIn = document.getElementById('new-price-lbp');
    if (lbpIn) {
        lbpIn.addEventListener('input', () => {
            // تصفير حقل نسبة العرض الخاص تلقائياً
            const specialOfferInput = document.getElementById('special-offer-percentage');
            if (specialOfferInput) specialOfferInput.value = "";

            // تصفير حقل السعر قبل العرض (اختياري) تلقائياً
            const oldPriceInput = document.getElementById('product-old-price');
            if (oldPriceInput) oldPriceInput.value = "";

            convertToUSD();    
            calculateProfit(); 
        });
    }
});
// 🔥 تحديث الدالة لفتح النافذة السرية بدلاً من الـ prompt دون حذف أكوادك الأصلية 🔥
function openFinancePage() {
    document.getElementById('finance-password-modal').style.display = 'flex';
    document.getElementById('finance-admin-input').value = '';
    document.getElementById('finance-admin-input').focus();
}

// دالة إغلاق نافذة المالية عند الضغط على إلغاء
function closeFinanceModal() {
    document.getElementById('finance-password-modal').style.display = 'none';
}

// دالة التحقق الآمنة والمعالجة المضافة لتشغيل الكود السري الخاص بك
function submitFinancePassword() {
    const pass = document.getElementById('finance-admin-input').value;
    
    // شرط التحقق الأصلي الخاص بك (لم يتغير منه حرف)
    if (pass === "2004") { 
        document.getElementById('finance-password-modal').style.display = 'none';
        window.location.href = "finance.html";
    } else {
        alert("خطأ!");
        document.getElementById('finance-admin-input').value = '';
        document.getElementById('finance-admin-input').focus();
    }
}
// 1. دالة التحكم في إظهار وإخفاء حقول اختيار الأرقام والفلترة تلقائياً
// 1. دالة التحكم في إظهار وإخفاء حقول اختيار الأرقام والفلترة تلقائياً
// ==========================================
// قسم استيراد وتصفية المنتجات من ملف CSV إلى Firebase (نسخة مدمجة ومحمية بالكامل)
// ==========================================

// جعل الدالة تعريفية ثابتة ومباشرة على مستوى الـ window لضمان عدم حدوث خطأ Not Defined في الـ HTML
window.toggleFilterInputs = function() {
    const modeInput = document.querySelector('input[name="upload-mode"]:checked');
    if (!modeInput) return;
    
    const mode = modeInput.value;
    const container = document.getElementById('filter-inputs-container');
    if (!container) return;
    
    const rangeDiv = document.getElementById('range-inputs-div');
    const specificIdsInput = document.getElementById('filter-specific-ids');
    const keywordInput = document.getElementById('filter-keyword');

    container.style.display = 'flex';
    
    // إظهار الحقل المطلوب بناءً على اختيارك للأرقام
    if (mode === 'all') {
        container.style.display = 'none';
    } else {
        if (rangeDiv) rangeDiv.style.display = (mode === 'by-range') ? 'flex' : 'none';
        if (specificIdsInput) specificIdsInput.style.display = (mode === 'by-specific-ids') ? 'block' : 'none';
        if (keywordInput) keywordInput.style.display = (mode === 'by-keyword') ? 'block' : 'none';
    }
};

// الدالة الأساسية والمحمية لقراءة ومعالجة الملف ورفعه لـ Firebase
window.processAndUploadCSV = function() {
    const fileInput = document.getElementById('csv-file-input');
    const statusDiv = document.getElementById('upload-progress-status');
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("الرجاء اختيار ملف CSV أولاً!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    statusDiv.innerHTML = "⏳ جاري قراءة الملف وتصفية البيانات...";
    statusDiv.style.color = "#f39c12";

    reader.onload = async function(e) {
        try {
            const text = e.target.result;
            const lines = text.split(/\r?\n/);
            if (lines.length <= 1) {
                alert("الملف لا يحتوي على بيانات صالحة!");
                return;
            }

            // تحليل وقراءة السطر الأول (العناوين) بدقة
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const idIndex = headers.indexOf('id');
            
            let nameIndex = headers.indexOf('name');
            if (nameIndex === -1) nameIndex = headers.findIndex(h => h.includes('name'));
            
            let priceIndex = headers.indexOf('price');
            if (priceIndex === -1) priceIndex = headers.findIndex(h => h.includes('price'));
            
            const barcodeIndex = headers.indexOf('barcode');

            // جلب خيار الفلترة والتحديد الحالي
            const modeInput = document.querySelector('input[name="upload-mode"]:checked');
            const mode = modeInput ? modeInput.value : 'all';
            
            const startId = parseInt(document.getElementById('filter-start-id')?.value) || 0;
            const endId = parseInt(document.getElementById('filter-end-id')?.value) || Infinity;
            const keyword = document.getElementById('filter-keyword')?.value.trim().toLowerCase() || "";
            
            const specificIdsText = document.getElementById('filter-specific-ids')?.value || "";
            const specificIdsArray = specificIdsText.split(',').map(id => id.trim()).filter(id => id !== "");

            let batchCount = 0;
            let successCount = 0;
            
            // استخدام نظام الـ Batch المتوافق مع نسخة الـ Compat الحالية لديك في المتجر
            let batch = firebase.firestore().batch(); 

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                const columns = lines[i].split(',');
                if (columns.length < 2) continue;

                const id = columns[idIndex]?.trim();
                const name = columns[nameIndex]?.trim();
                const price = parseFloat(columns[priceIndex]?.trim()) || 0;
                const barcode = columns[barcodeIndex]?.trim() || "";

                if (!name || !id) continue;

                // التصفية والتحقق الذكي من أرقام المنتجات المطلوبة
                if (mode === 'by-range') {
                    const numericId = parseInt(id);
                    if (isNaN(numericId) || numericId < startId || numericId > endId) continue;
                } else if (mode === 'by-specific-ids') {
                    if (!specificIdsArray.includes(id)) continue; 
                } else if (mode === 'by-keyword') {
                    if (!name.toLowerCase().includes(keyword)) continue;
                }

                // إصلاح خطأ التحديث الذاتي الشامل:
                // نضمن استخدام صيغة نصية فريدة وثابتة لمنع حدوث خطأ No document to update في مستندات Firebase الجديدة
                const docId = barcode ? barcode : `product_${id}`;
                const productRef = db.collection('products').doc(docId);

                // حفظ وتحديث السعر والبيانات فوراً مع دمج التغييرات الآمنة
                batch.set(productRef, {
                    id: id,
                    name: name,
                    price: price,
                    barcode: barcode,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                batchCount++;
                successCount++;

                // تقسيم الإرسال إلى دفعات آمنة لضمان السرعة القصوى وعدم تعليق الشاشة
                if (batchCount >= 400) {
                    statusDiv.innerHTML = `⏳ جاري رفع وتثبيت المنتجات... (${successCount} منتج)`;
                    await batch.commit();
                    batch = firebase.firestore().batch();
                    batchCount = 0;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }

            statusDiv.innerHTML = `✅ تم رفع وتحديث ${successCount} منتج بنجاح في Firebase!`;
            statusDiv.style.color = "#27ae60";
            alert(`🎉 نجح الأمر تماماً! تم استيراد وتحديث المنتجات المطلوبة في قاعدة البيانات بنجاح. العدد: ${successCount}`);
            
            if (typeof loadInventory === "function") loadInventory();
            if (typeof loadProducts === "function") loadProducts();

        } catch (err) {
            console.error("خطأ أثناء المعالجة:", err);
            statusDiv.innerHTML = "❌ حدث خطأ أثناء رفع البيانات، راجع الكونسول.";
            statusDiv.style.color = "#e74c3c";
        }
    };

    reader.readAsText(file, 'UTF-8');
};
// 🔥 دالة البحث الفوري داخل جدول الجرد دون التأثير على جلب البيانات الأصلي 🔥
function searchInventoryTable() {
    // قراءة النص المكتوب في خانة البحث وتحويله للاحرف الصغيرة
    const filter = document.getElementById("inventory-search-input").value.toLowerCase().trim();
    const tbody = document.getElementById("inventory-table-body");
    
    if (!tbody) return;
    
    // الحصول على جميع السطور (rows) بداخل الـ tbody
    const rows = tbody.getElementsByTagName("tr");
    
    for (let i = 0; i < rows.length; i++) {
        // العمود الأول (index 0) هو المسؤول عن اسم الصنف
        const itemCell = rows[i].getElementsByTagName("td")[0];
        
        if (itemCell) {
            const itemName = itemCell.textContent || itemCell.innerText;
            
            // إذا كان اسم الصنف يحتوي على الكلمة المكتوبة يظهر، وإلا يختفي
            if (itemName.toLowerCase().indexOf(filter) > -1) {
                rows[i].style.display = "";
            } else {
                rows[i].style.display = "none";
            }
        }
    }
}
// 🔥 دالة تصفية وحساب أرباح فترة معينة دون مساس بأكوادك السابقة 🔥
async function filterProfitByPeriod() {
    const startDateVal = document.getElementById("report-start-date").value;
    const endDateVal = document.getElementById("report-end-date").value;

    if (!startDateVal || !endDateVal) {
        alert("الرجاء اختيار تاريخ البداية والنهاية أولاً 🗓️");
        return;
    }

    // إعداد التوقيت لتبدأ من أول ثانية في اليوم الأول إلى آخر ثانية في اليوم الأخير
    let startTimestamp = new Date(startDateVal);
    startTimestamp.setHours(0, 0, 0, 0);

    let endTimestamp = new Date(endDateVal);
    endTimestamp.setHours(23, 59, 59, 999);

    if (startTimestamp > endTimestamp) {
        alert("خطأ: تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية!");
        return;
    }

    // الحصول على سعر الصرف الحالي من الـ localStorage أو افتراضي 90,000 ليرة
    let currentRate = parseFloat(localStorage.getItem('exchangeRate')) || 90000;

    try {
        // جلب مستندات المبيعات بالكامل لتصفيتها زمنياً بدقة
        const salesSnap = await db.collection("sales").get();
        
        let totalUSD = 0;
        let orderCount = 0;

        salesSnap.forEach(doc => {
            const data = doc.data();
            if (data && data.time) {
                // تحويل الـ Timestamp الخاص بـ Firebase إلى تاريخ JS للمقارنة
                const invoiceDate = data.time.toDate();

                // التحقق إذا كان تاريخ الفاتورة يقع داخل الفترة المحددة
                if (invoiceDate >= startTimestamp && invoiceDate <= endTimestamp) {
                    const amt = parseFloat(data.totalUSD || data.total_usd || data.total || 0);
                    totalUSD += amt;
                    orderCount++;
                }
            }
        });

        // حساب المبيعات بالليرة اللبنانية مع تقريب لأقرب 500 ليرة
        const totalLBP = Math.round((totalUSD * currentRate) / 500) * 500;

        // تحديث أرقام الكارت الأخضر في الشاشة فوراً
        document.getElementById("report-order-count").innerText = orderCount;
        document.getElementById("report-total-usd").innerText = totalUSD.toFixed(2) + " $";
        document.getElementById("report-total-lbp").innerText = totalLBP.toLocaleString('ar-LB') + " ل.ل";

    } catch (error) {
        console.error("خطأ أثناء احتساب تقرير الفترة المحددة:", error);
        alert("حدث خطأ أثناء جلب البيانات: " + error.message);
    }
}
// ==========================================
// دالة جلب ملخص مبيعات اليوم وأداء الموظفين من Firebase
// ==========================================
async function loadTodayStaffPerformance() {
    try {
        // 1. تحديد بداية ونهاية اليوم الحالي بالكامل
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // 2. جلب فواتير اليوم من مجموعة الفواتير (تأكد من مطابقة اسم الـ Collection لديك مثلاً 'sales' أو 'orders')
        // سنعتمد هنا على اسم الـ Collection الشائع في ملفك وهو 'sales' أو 'orders'
        const salesSnap = await db.collection('sales').get(); 

        let todayTotalUSD = 0;
        let todayOrdersCount = 0;
        let lastEmployeeName = "غير محدد";
        
        // كائن (Object) لتجميع أداء كل موظف على حدة
        const staffData = {};

        salesSnap.forEach(doc => {
            const data = doc.data();
            if (data && data.time) {
                const invoiceDate = data.time.toDate(); // تحويل التوقيت

                // فحص إذا كانت الفاتورة تابعة لليوم الحالي
                if (invoiceDate >= startOfDay && invoiceDate <= endOfDay) {
                    // جلب اسم الموظف من الفاتورة (يدعم الحقول المحتملة: cashierName أو employee أو staff)
                    const empName = data.cashierName || data.employee || data.staff || "موظف عام";
                    const amt = parseFloat(data.totalUSD || data.total_usd || data.total || 0);

                    // تحديث الإجمالي العام لليوم
                    todayTotalUSD += amt;
                    todayOrdersCount++;
                    lastEmployeeName = empName; // آخر موظف قام بعملية بيع

                    // تجميع البيانات لكل موظف بشكل منفصل
                    if (!staffData[empName]) {
                        staffData[empName] = { orders: 0, total: 0 };
                    }
                    staffData[empName].orders += 1;
                    staffData[empName].total += amt;
                }
            }
        });

        // 3. تحديث العناصر العلوية في الواجهة (ملخص اليوم)
        if (document.getElementById("today-employee-name")) {
            document.getElementById("today-employee-name").innerText = lastEmployeeName;
        }
        if (document.getElementById("today-total-usd")) {
            document.getElementById("today-total-usd").innerText = todayTotalUSD.toFixed(2) + " $";
        }
        if (document.getElementById("today-orders-count")) {
            document.getElementById("today-orders-count").innerText = todayOrdersCount;
        }

        // 4. بناء وتحديث جدول "أداء الموظفين" بالبيانات الحية
        const performanceBody = document.getElementById("staff-performance-body");
        if (performanceBody) {
            performanceBody.innerHTML = ""; // تصفير الجدول قبل التعبئة

            // تحويل كائن الموظفين إلى أسطر داخل الجدول
            Object.keys(staffData).forEach(worker => {
                const row = `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px; color: black; font-weight: bold;">👤 ${worker}</td>
                        <td style="padding: 10px; text-align: center; color: black;">${staffData[worker].orders}</td>
                        <td style="padding: 10px; text-align: center; color: #27ae60; font-weight: bold;">${staffData[worker].total.toFixed(2)} $</td>
                    </tr>
                `;
                performanceBody.innerHTML += row;
            });

            // إذا لم تكن هناك مبيعات اليوم
            if (Object.keys(staffData).length === 0) {
                performanceBody.innerHTML = `<tr><td colspan="3" style="padding: 15px; text-align: center; color: #999;">لا توجد مبيعات مسجلة للموظفين اليوم بعد.</td></tr>`;
            }
        }

    } catch (error) {
        console.error("خطأ أثناء جلب أداء الموظفين:", error);
    }
}

// تشغيل الدالة تلقائياً عند تحميل الصفحة لضمان عرض البيانات فوراً
window.addEventListener('DOMContentLoaded', () => {
    if (typeof loadTodayStaffPerformance === "function") {
        loadTodayStaffPerformance();
        // إعادة التشغيل كل دقيقة لتحديث الأرقام حية
        setInterval(loadTodayStaffPerformance, 60000); 
    }
});
// دالة تحويل سعر الشراء من دولار إلى ليرة لبنانية تلقائياً
// دالة تحويل سعر الشراء من دولار إلى ليرة لبنانية تلقائياً
function convertCostToLBP() {
    const costUSDInput = document.getElementById('product-cost-input');
    const costLBPInput = document.getElementById('product-cost-lbp-input');
    if (!costUSDInput || !costLBPInput) return;

    const costUSD = parseFloat(costUSDInput.value) || 0;
    if (costUSD > 0) {
        // حساب السعر بالليرة بناءً على سعر الصرف المتوفر بالنظام
        costLBPInput.value = Math.round(costUSD * exchangeRate);
    } else {
        costLBPInput.value = ''; // تصفير الحقل إذا كانت القيمة صفر أو فارغة
    }
}

// دالة تحويل سعر الشراء من ليرة لبنانية إلى دولار تلقائياً عند الكتابة بالليرة
function convertCostToUSD() {
    const costUSDInput = document.getElementById('product-cost-input');
    const costLBPInput = document.getElementById('product-cost-lbp-input');
    if (!costUSDInput || !costLBPInput) return;

    const costLBP = parseFloat(costLBPInput.value) || 0;
    if (costLBP > 0) {
        // حساب السعر بالدولار وتدويره لمرتبتين عشريتين
        costUSDInput.value = (costLBP / exchangeRate).toFixed(2);
    } else {
        costUSDInput.value = ''; // تصفير الحقل إذا كانت القيمة صفر أو فارغة
    }
}
// --- دالة جلب وعرض زبائن الولاء حياً في الجدول ---
// --- دالة جلب وعرض زبائن الولاء حياً في الجدول المحدثة بالكامل مع الحذف ---
// --- 1. دالة إضافة النقاط يدوياً عند الضغط على زر (إضافة 5$) ---
function addManualPoints(userId, pointsAmount = 1) {
    if (!userId) return;

    // تأكيد العملية لحماية البيانات من الضغط العشوائي
    if (confirm(`هل تريد إضافة نقاط بقيمة 5$ (تعادل ${pointsAmount} نقطة) لحساب هذا الزبون؟`)) {
        const customerRef = db.collection("users").doc(userId);

        // استخدام increment لزيادة النقاط بشكل تراكمي حياً في السيرفر دون مسح البيانات القديمة
        customerRef.set({
            totalPoints: firebase.firestore.FieldValue.increment(pointsAmount),
            lastPurchase: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
        .then(() => {
            alert("🎯 تم إضافة النقاط بنجاح وتحديث حساب الزبون!");
        })
        .catch((error) => {
            console.error("خطأ أثناء إضافة النقاط يدوياً: ", error);
            alert("فشل إضافة النقاط: " + error.message);
        });
    }
}

// --- 2. دالة جلب وعرض زبائن الولاء حياً في الجدول المحدثة بالكامل لربط الزرين معاً ---
function loadLoyaltyCustomersRealtime() {
    const listContainer = document.getElementById("customers-list");
    if (!listContainer) return; 
    
    db.collection("users").onSnapshot((querySnapshot) => {
        listContainer.innerHTML = ''; 

        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // فحص النقاط والتاريخ لضمان التوافق مع القديم والجديد
            const totalPoints = data.totalPoints !== undefined ? data.totalPoints : (data.points !== undefined ? data.points : 0);

            let lastActivity = "لا يوجد";
            if (data.lastPurchase) {
                lastActivity = new Date(data.lastPurchase.seconds * 1000).toLocaleDateString('ar-LB');
            } else if (data.lastOrder) {
                lastActivity = new Date(data.lastOrder.seconds * 1000).toLocaleDateString('ar-LB');
            }

            const customerPhone = data.phone || doc.id;

            // بناء أسطر الجدول وتمرير المعرف doc.id لدالة الإضافة ودالة الحذف بنجاح
            listContainer.innerHTML += `
                <tr>
                    <td style="font-weight: 700; direction: ltr; text-align: right;">${customerPhone}</td>
                    <td style="font-weight: bold; color: #2ecc71;">${totalPoints} نقطة</td>
                    <td>${lastActivity}</td>
                    <td>
                        <button class="btn-add-5" style="background-color: #2ecc71; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-left: 5px;" onclick="addManualPoints('${doc.id}', 1)">إضافة 5$</button>
                        
                        <button class="btn-delete" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;" onclick="deleteLoyaltyUser('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }, (error) => {
        console.error("خطأ أثناء جلب زبائن الولاء: ", error);
    });
}
// --- دالة حذف زبون الولاء نهائياً من قاعدة البيانات ---
function deleteLoyaltyUser(userId) {
    if (!userId) return;
    
    // إظهار نافذة تأكيد حمايةً من الحذف بالخطأ
    if (confirm("هل أنت متأكد من حذف هذا الزبون نهائياً؟ لا يمكن التراجع عن هذه العملية.")) {
        db.collection("users").doc(userId).delete()
        .then(() => {
            alert("تم حذف الزبون بنجاح.");
        })
        .catch((error) => {
            console.error("خطأ أثناء حذف الزبون: ", error);
            alert("فشل الحذف: " + error.message);
        });
    }
}
// دالة لتزويد وزيادة كمية المخزن لأي منتج حياً في السيرفر عند ضغط زر زيادة
async function addStockQuantity(productId, productName) {
    if (!productId) return;

    // طلب الكمية المراد إضافتها من المستخدم عبر نافذة إدخال ذكية
    let amountInput = prompt(`أدخل الكمية التي تريد إضافتها لمنتج (${productName}):`, "10");
    if (amountInput === null) return; // إذا ضغط إلغاء

    let addedQty = parseInt(amountInput);
    if (isNaN(addedQty) || addedQty <= 0) {
        alert("يرجى إدخال رقم صحيح أكبر من الصفر!");
        return;
    }

    try {
        // تحديث الكمية تراكمياً في السيرفر باستخدام increment
        await db.collection('products').doc(productId).update({
            stock: firebase.firestore.FieldValue.increment(addedQty)
        });

        alert(`تم إضافة ${addedQty} قطع بنجاح لمنتج ${productName}.`);
        loadInventory(); // إعادة تحديث الجدول تلقائياً ليظهر الرقم الجديد فوراً أمامك
    } catch (error) {
        console.error("خطأ أثناء زيادة المخزون:", error);
        alert("فشل تحديث المخزون في السيرفر: " + error.message);
    }
}
// أضف هذا السطر في نهاية دالة checkMyPoints مثلاً
document.getElementById('points-result').scrollIntoView({ behavior: 'smooth', block: 'center' });