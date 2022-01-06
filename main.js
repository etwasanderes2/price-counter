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
        searchParsed() {
            return this.parseMoney(this.searchbar);
        },
        visibleRows() {
            return this.rows.filter(item =>
                this.formatMoney(item.price).includes(this.searchbar)
            );
        },
        exactMatch() {
            if (isNaN(this.searchParsed)) {
                return false;
            }
            for (r of this.rows) {
                if (r.price === this.searchParsed) {
                    return true;
                }
            }
            return false;
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
        window.addEventListener('keyup', (e) => {
            // console.log(e);
            if (e.key == 'l' && !e.target.classList.contains('keycapture')) {
                let sb = this.$refs.sb;
                sb.focus();
                sb.select();
            }
        })
    },
    methods: {
        // helpers
        formatMoney(money) {
            return (money / 100).toFixed(2);
        },
        parseMoney(str) {
            return Math.round(parseFloat(str) * 100);
        },
        // UI Stuff
        async updateRows() {
            // console.log("upate rows")
            // hope that indexeddb is sorted
            this.rows = await this.getItemsFromDb();
        },
        async addPrice() {
            // console.log("add Price")
            let price = this.searchParsed
            if (isNaN(price)) {
                console.warn("Bad number")
                return;
            }
            if (this.exactMatch) {
                await this.incrementItemInDb(price, 1);
                await this.updateRows();
            } else {
                let item = {
                    price: price,
                    count: 0
                }
                await this.addItemToDb(item);
                await this.updateRows()
            }
        },
        async increment(price, amount) {
            await this.incrementItemInDb(price, amount);
            await this.updateRows();
        },
        async incrementBy(price) {
            this.inc.price = price;
            this.inc.amount = '';
            this.inc.show = true;
            this.$nextTick(() => {
                this.$refs.incInp.focus();
            })
        },
        async incrementByActual(price) {
            await this.incrementItemInDb(price, parseInt(this.inc.amount));
            await this.updateRows();
            this.inc.show = false;
        },
        async setTo(price, amount) {
            await this.setItemInDb(price, amount);
            await this.updateRows();
        },
        async deleteItem(price) {
            await this.deleteItemFromDb(price);
            await this.updateRows();
        },
        async clearAll() {
            // we won't log all db access and just log this
            console.info("Clear Table: " + JSON.stringify(this.rows));
            await this.clearDb();
            await this.updateRows();
        },
        async exportJson() {
            navigator.clipboard.writeText(JSON.stringify(this.rows)).then(function() {
                console.log("Copy Clipboard OK");
            }, function() {
                console.error("Copy Clipboard FAILED");
            });
        },
        focusSearch() {
            console.log("focus search");
            this.$refs.sb.focus();
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
                console.info("Added item " + item.price + " at " + item.count);
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
                    var oldcount = item.count
                    item.count += amount;
                    store.put(item);
                    console.info("Incremented " + item.price + " from " + oldcount + " to " + item.count + " (by " + amount + ")");
                };

            });
        },
        async setItemInDb(price, amount) {
            return new Promise((resolve, reject) => {
                let trans = this.db.transaction(this.activedb, 'readwrite');
                trans.oncomplete = e => {
                    resolve();
                };

                let store = trans.objectStore(this.activedb);
                let itemrq = store.get(price);
                itemrq.onsuccess = function() {
                    var item = itemrq.result;
                    var oldcount = item.count
                    item.count = amount;
                    store.put(item);
                    console.info("Set " + item.price + " from " + oldcount + " to " + item.count);
                };

            });
        },
        async deleteItemFromDb(price) {
            return new Promise((resolve, reject) => {
                let trans = this.db.transaction(this.activedb, 'readwrite');
                trans.oncomplete = e => {
                    resolve();
                };

                let store = trans.objectStore(this.activedb);
                let itemrq = store.get(price);
                itemrq.onsuccess = function() {
                    store.delete(price);
                    console.info("Deleted " + itemrq.result.price + " was " + itemrq.result.count);
                }
            });
        },
        async clearDb() {
            return new Promise((resolve, reject) => {
                let trans = this.db.transaction(this.activedb, 'readwrite');
                trans.oncomplete = e => {
                    resolve();
                };

                let store = trans.objectStore(this.activedb);
                store.delete(IDBKeyRange.lowerBound(0));
                console.info("Cleared DB");
            })
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