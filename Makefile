build:
	docker build -t gptvoicetelegram .

run:
	docker run -d -p 3000:3000 --name gptvoicetelegram --rm gptvoicetelegram