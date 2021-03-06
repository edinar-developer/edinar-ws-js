// var { List } = require("immutable");
let ChainWebSocket = require("./ChainWebSocket");
let GrapheneApi = require("./GrapheneApi");
let ChainConfig = require("./ChainConfig");

class ApisInstance {
	
	/** @arg {string} connection .. */
	connect(cs) {
		
		// console.log("INFO\tApiInstances\tconnect\t", cs);
		
		let rpc_user = "", rpc_password = "";
		if(typeof window !== "undefined" && window.location && window.location.protocol === "https:" && cs.indexOf("wss://") < 0) {
			throw new Error("Secure domains require wss connection");
		}
		
		this.ws_rpc = new ChainWebSocket(cs, this.statusCb);
		
		this.init_promise = this.ws_rpc.login(rpc_user, rpc_password).then(() => {
			// console.log("Login done");
			this._db = new GrapheneApi(this.ws_rpc, "database");
			this._net = new GrapheneApi(this.ws_rpc, "network_broadcast");
			this._hist = new GrapheneApi(this.ws_rpc, "history");
			this._crypt = new GrapheneApi(this.ws_rpc, "crypto");
			let db_promise = this._db.init().then(() => {
				//https://github.com/cryptonomex/graphene/wiki/chain-locked-tx
				return this._db.exec("get_chain_id", []).then(_chain_id => {
					this.chain_id = _chain_id;
					return ChainConfig.setChainId(_chain_id)
					//DEBUG console.log("chain_id1",this.chain_id)
				});
			});
			this.ws_rpc.on_reconnect = () => {
				this.ws_rpc.login("", "").then(() => {
					this._db.init().then(() => {
						if(this.statusCb)
							this.statusCb("reconnect");
					});
					this._net.init();
					this._hist.init();
					this._crypt.init();
				});
			};
			return Promise.all([
				db_promise,
				this._net.init(),
				this._hist.init(),
				this._crypt.init()
				// Temporary squash crypto API error until the API is upgraded everywhere
					.catch(e => console.error("ApiInstance\tCrypto API Error", e))
			]);
		});
	}
	
	close() {
		if(this.ws_rpc) this.ws_rpc.close();
		this.ws_rpc = null;
	}
	
	db_api() {
		return this._db;
	}
	
	network_api() {
		return this._net;
	}
	
	history_api() {
		return this._hist;
	}
	
	crypto_api() {
		return this._crypt;
	}
	
	setRpcConnectionStatusCallback(callback) {
		this.statusCb = callback;
	}
}

module.exports = ApisInstance;
