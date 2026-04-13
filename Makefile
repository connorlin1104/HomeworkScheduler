.PHONY: install start dev clean reset

install:
	npm install

start:
	npm start

dev:
	npm run dev

clean:
	rm -rf node_modules

reset: clean
	rm -f data/db.json
