{
    servers {
        trusted_proxies static private_ranges
    }
}

:80 {
    handle /admin/* {
        root * /srv/www
        try_files {path} /admin/index.html
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

    handle /assets/* {
        root * /srv/www
        file_server
    }

    handle /api/* {
        reverse_proxy backend:8000
    }

    handle / {
        root * /srv/www
        try_files {path} /landing/index.html
        file_server
    }

    handle /landing/* {
        root * /srv/www
        try_files {path} /landing/index.html
        file_server
    }

    respond 404
}
