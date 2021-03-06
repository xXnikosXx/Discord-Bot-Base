//THIS IS A FILE TESTING THE BOT'S CURRENCY SYSTEM - THE MAIN JS FILE FOR THE BOT IS INDEX.JS

// Require the discord.js module (more info for discord.js at: discord.js.org)
const Discord = require("discord.js");

// Create a new Discord client.
const client = new Discord.Client();
const { Users, CurrencyShop } = require("./dbObjects");
// Require the sequelize module (for storing data with Sequelize)
// DON'T USE SEQUELIZE 4!!! ONLY SEQUELIZE 5 OR LATER!!
const { Op } = require("sequelize");
const currency = new Discord.Collection();
const PREFIX = "//"; //change the prefix here

Reflect.defineProperty(currency, "add", {
	value: async function add(id, amount) {
		const user = currency.get(id);
		if (user) {
			user.balance += Number(amount);
			return user.save();
		}
		const newUser = await Users.create({ user_id: id, balance: amount });
		currency.set(id, newUser);
		return newUser;
	},
});

Reflect.defineProperty(currency, "getBalance", {
	value: function getBalance(id) {
		const user = currency.get(id);
		return user ? user.balance : 0;
	},
});

// The following code will run once, right after the bot has logged in.
client.once("ready", async () => {
	const storedBalances = await Users.findAll();
	storedBalances.forEach(b => currency.set(b.user_id, b));
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", async message => {
	if (message.author.bot) return;
	currency.add(message.author.id, 1);

	if (!message.content.startsWith(PREFIX)) return;
	const input = message.content.slice(PREFIX.length).trim();
	if (!input.length) return;
	const [, command, commandArgs] = input.match(/(\w+)\s*([\s\S]*)/);

	if (command === "balance") {
		const curTarget = message.mentions.users.first() || message.author;
		return message.channel.send(`${curTarget.tag} has ${currency.getBalance(curTarget.id)}💰`);
	}
	else if (command === "inventory") {
		const curTarget = message.mentions.users.first() || message.author;
		const user = await Users.findOne({ where: { user_id: curTarget.id } });
		const items = await user.getItems();

		if (!items.length) return message.channel.send(`${curTarget.tag} has nothing!`);
		return message.channel.send(`${curTarget.tag} currently has ${items.map(t => `${t.amount} ${t.item.name}`).join(", ")}`);
	}
	else if (command === "transfer") {
		const currentAmount = currency.getBalance(message.author.id);
		const transferAmount = commandArgs.split(/ +/).find(arg => !/<@!?\d+>/.test(arg));
		const transfercurTarget = message.mentions.users.first();

		message.channel.send(input);
		message.channel.send(commandArgs);
		message.channel.send(transferAmount);

		if (!transferAmount || isNaN(transferAmount)) return message.channel.send(`Sorry ${message.author}, that's an invalid amount`);
		if (transferAmount > currentAmount) return message.channel.send(`Sorry ${message.author} you don't have that much.`);
		if (transferAmount <= 0) return message.channel.send(`Please enter an amount greater than zero, ${message.author}`);

		currency.add(message.author.id, -transferAmount);
		currency.add(transfercurTarget.id, transferAmount);

		return message.channel.send(`Successfully transferred ${transferAmount}💰 to ${transfercurTarget.tag}. Your current balance is ${currency.getBalance(message.author.id)}💰`);
	}
	else if (command === "buy") {
		const item = await CurrencyShop.findOne({ where: { name: { [Op.like]: commandArgs } } });
		if (!item) return message.channel.send("That item doesn't exist.");
		if (item.cost > currency.getBalance(message.author.id)) {
			return message.channel.send(`You don't have enough currency, ${message.author}`);
		}

		const user = await Users.findOne({ where: { user_id: message.author.id } });
		currency.add(message.author.id, -item.cost);
		await user.addItem(item);

		message.channel.send(`You've bought a ${item.name}`);
	}
	else if (command === "shop") {
		const items = await CurrencyShop.findAll();
		return message.channel.send(items.map(i => `${i.name}: ${i.cost}💰`).join("\n"), { code: true });
	}
	else if (command === "leaderboard") {
		return message.channel.send(
			currency.sort((a, b) => b.balance - a.balance)
				.filter(user => client.users.cache.has(user.user_id))
				.first(10)
				.map((user, position) => `(${position + 1}) ${(client.users.cache.get(user.user_id).tag)}: ${user.balance}💰`)
				.join("\n"),
			{ code: true },
		);
	}
});

// Login to Discord with the bot's token (get one from the discord developer portal)
client.login("BOT_TOKEN_HERE");
