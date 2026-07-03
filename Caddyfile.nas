{
    auto_https off
    servers {
        trusted_proxies static private_ranges 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 104.16.0.0/13 104.24.0.0/14 108.162.192.0/18 131.0.72.0/22 141.101.64.0/18 162.158.0.0/15 172.64.0.0/13 173.245.48.0/20 188.114.96.0/20 190.93.240.0/20 197.234.240.0/22 198.41.128.0/17 2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32
    }
}

:80 {
    handle /api/* {
        reverse_proxy backend:8000
    }

    handle /admin/* {
        root * /srv/www
        try_files {path} /admin/index.html
        file_server
    }

    handle /landing/* {
        root * /srv/www
        try_files {path} /landing/index.html
        file_server
    }

    handle /nkhockey/* {
        root * /srv/www
        try_files {path} /nkhockey/index.html
        file_server
    }

    handle /mixmusic/* {
        root * /srv/www
        try_files {path} /mixmusic/index.html
        file_server
    }

    handle /dontforget/* {
        root * /srv/www
        try_files {path} /dontforget/index.html
        file_server
    }

    handle /account/* {
        root * /srv/www
        try_files {path} /account/index.html
        file_server
    }

    handle /tournix/* {
        root * /srv/www
        try_files {path} /tournix/index.html
        file_server
    }

    handle /fiets/* {
        root * /srv/www
        try_files {path} /fiets/index.html
        file_server
    }

    handle /poulebord/* {
        root * /srv/www
        try_files {path} /poulebord/index.html
        file_server
    }

    handle /assets/* {
        root * /srv/www
        file_server
    }

    handle /favicon.svg {
        root * /srv/www
        file_server
    }

    handle / {
        root * /srv/www
        try_files {path} /landing/index.html
        file_server
    }

    respond 404
}
