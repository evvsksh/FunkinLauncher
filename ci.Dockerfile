FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    ca-certificates \
    xvfb \
    dbus-x11 \
    flatpak \
    flatpak-builder \
    sudo \
    wget \
    gnupg \
    software-properties-common \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

RUN cargo install tauri-cli

RUN flatpak remote-add --if-not-exists flathub \
    https://flathub.org/repo/flathub.flatpakrepo

RUN flatpak install -y --system flathub \
    org.gnome.Platform//48 \
    org.gnome.Sdk//48

WORKDIR /app
