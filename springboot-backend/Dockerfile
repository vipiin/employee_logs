# -------- BUILD STAGE --------
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY . .
RUN chmod +x mvnw
RUN ./mvnw -q -DskipTests clean package

# -------- RUNTIME STAGE --------
FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
COPY --from=build /app/src/main/resources/aiven-kafka-ca.pem aiven-kafka-ca.pem

CMD ["java", "-jar", "app.jar"]
