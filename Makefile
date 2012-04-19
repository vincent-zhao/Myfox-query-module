ENV=test

test: conf
	@npm install
	-./node_modules/mocha/bin/mocha --reporter tap --ignore-leaks -t 20000 test/unit/test.*.js

conf:
	@npm install -g jake
	@jake 'generateConfig[$(ENV)]'

clean:
	@cd conf && touch useless && rm *
	@cd run && touch useless && rm *

.PHONY: test conf
