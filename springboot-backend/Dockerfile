# Use Eclipse Temurin JDK (Java 17)
FROM eclipse-temurin:17-jdk-alpine

# Set working directory
WORKDIR /app

# Copy Maven wrapper and project files
COPY . .

# Build the application
RUN ./mvnw -q -e -DskipTests clean package

# Run app on startup
CMD ["java", "-jar", "target/*.jar"]
