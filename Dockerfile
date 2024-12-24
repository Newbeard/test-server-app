# Используем официальный образ Node.js
FROM node:18

# Устанавливаем рабочую директорию в контейнере
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь проект
COPY . .

# Открываем порт, который будет использовать ваше приложение
EXPOSE 3001

# Команда для запуска приложения
CMD ["npm", "start"]
