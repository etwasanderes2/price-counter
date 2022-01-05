const DB_NAME = 'testdb';
const DB_VERSION = 1;

var app = new Vue({
    el: '#app',
    data: {
        db: null,
        rows: [],
        searchbar: "",
        activedb: "items",
        separator: '.',
        inc: {
            show: false,
            price: null,
            amount: 0
        }
    },
    computed: {
        visibleRows() {
            return this.rows.filter(item =>
                this.formatMoney(item.price).includes(this.searchbar)
            );
        },
        total() {
            return this.rows.reduce(
                (acc, a) => a.count * a.price + acc,
                0
            )
        }
    },
    async created() {
        this.db = await this.getDb();
        this.updateRows();
    },
    methods: {
        // helpers
        formatMoney(money) {
            return (money / 100).toFixed(2);
        },
        parseMoney(str) {
            return parseFloat(str) * 100;
        },
        // UI Stuff
        async updateRows() {
            console.log("upate rows")
            this.rows = await this.getItemsFromDb();
        },
        async addPrice() {
            console.log("add Price")
            let price = this.parseMoney(this.searchbar)
            let item = {
                price: price,
                count: 0
            }
            await this.addItemToDb(item);
            await this.updateRows();
            this.searchbar = '';
        },
        async increment(price) {
            await this.incrementItemInDb(price, 1);
            await this.updateRows();
        },
        async incrementBy(price) {
            this.inc.price = price;
            this.inc.amount = '';
            this.inc.show = true;
        },
        async incrementByActual(price) {
            await this.incrementItemInDb(price, parseInt(this.inc.amount));
            await this.updateRows();
            this.inc.show = false;
        },

        // DB STUFF, mostl from https://www.raymondcamden.com/2019/10/16/using-indexeddb-with-vuejs
        async addItemToDb(item) {
            return new Promise((resolve, reject) => {

                let trans = this.db.transaction(this.activedb, 'readwrite');
                trans.oncomplete = e => {
                    resolve();
                };

                let store = trans.objectStore(this.activedb);
                store.add(item);

            });
        },
        async incrementItemInDb(price, amount) {
            return new Promise((resolve, reject) => {
                let trans = this.db.transaction(this.activedb, 'readwrite');
                trans.oncomplete = e => {
                    resolve();
                };

                let store = trans.objectStore(this.activedb);
                let itemrq = store.get(price);
                itemrq.onsuccess = function() {
                    var item = itemrq.result;
                    item.count += amount;
                    store.put(item);
                };

            });
        },
        async getItemsFromDb() {
            return new Promise((resolve, reject) => {

                let trans = this.db.transaction(this.activedb, 'readonly');
                trans.oncomplete = e => {
                    resolve(items);
                };

                let store = trans.objectStore(this.activedb);
                let items = [];

                store.openCursor().onsuccess = e => {
                    let cursor = e.target.result;
                    if (cursor) {
                        items.push(cursor.value)
                        cursor.continue();
                    }
                };

            });
        },
        async getDb() {
            return new Promise((resolve, reject) => {

                let request = window.indexedDB.open(DB_NAME, DB_VERSION);

                request.onerror = e => {
                    console.log('Error opening db', e);
                    reject('Error');
                };

                request.onsuccess = e => {
                    resolve(e.target.result);
                };

                request.onupgradeneeded = e => {
                    console.log('onupgradeneeded');
                    let db = e.target.result;
                    let objectStore = db.createObjectStore("items", { autoIncrement: false, keyPath: 'price' });
                };
            });
        }
    }
})