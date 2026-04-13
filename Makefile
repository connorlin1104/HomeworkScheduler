.PHONY: install start dev stop restart clean reset

PORT ?= 3000

# Run once after cloning, or when package.json changes.
install:
	npm install

# Kills whatever is on PORT first so you never have to manually stop the old process.
start:
	@-lsof -ti:$(PORT) | xargs kill -9 2>/dev/null; true
	@sleep 0.3
	node server.js

# Auto-restarts whenever you save a server-side file. Use this during development.
dev:
	npm run dev

stop:
	@-lsof -ti:$(PORT) | xargs kill -9 2>/dev/null; true
	@echo "Server stopped."

restart:
	$(MAKE) stop
	$(MAKE) start

# Remove installed packages (run install again afterwards).
clean:
	rm -rf node_modules

# Wipe the database back to empty.
reset:
	rm -f data/db.json
