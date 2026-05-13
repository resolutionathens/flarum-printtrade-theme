<?php

namespace ThePrintTrade\Theme\Provider;

use Flarum\Foundation\AbstractServiceProvider;
use Flarum\Forum\Auth\ResponseFactory as BaseResponseFactory;
use Flarum\Http\Rememberer;
use ThePrintTrade\Theme\Forum\Auth\TopLevelResponseFactory;

/**
 * Swap Flarum's stock auth ResponseFactory with our subclass — see
 * TopLevelResponseFactory's docblock for the why.
 */
class AuthOverrideProvider extends AbstractServiceProvider
{
    public function register(): void
    {
        $this->container->extend(BaseResponseFactory::class, function ($_, $container) {
            return new TopLevelResponseFactory($container->make(Rememberer::class));
        });
    }
}
